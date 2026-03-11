import { useCallback, useEffect, useRef, useState } from "react";
import { useWS } from "@/hooks/WebSocketContext";
import { type EditorSessionState } from "@/hooks/editorSessionState";

export type RopeOperation =
  | {
      event: "text_update";
      type: "insert";
      pos: number;
      value: string;
      version: number;
      author: number;
    }
  | {
      event: "text_update";
      type: "delete";
      from: number;
      to: number;
      version: number;
      author: number;
    };

function cloneOp(op: RopeOperation): RopeOperation {
  return op.type === "insert" ? { ...op } : { ...op };
}

function normalizeOp(op: RopeOperation | null): RopeOperation | null {
  if (!op) {
    return null;
  }
  if (op.type === "insert") {
    return op.value.length > 0 ? op : null;
  }
  return op.to > op.from ? op : null;
}

function authorPrecedes(left: number, right: number): boolean {
  return left < right;
}

function transformAgainstHistory(
  incoming: RopeOperation,
  history: RopeOperation,
): RopeOperation | null {
  const next = cloneOp(incoming);

  if (next.type === "insert" && history.type === "insert") {
    const historyLen = history.value.length;
    if (
      history.pos < next.pos ||
      (history.pos === next.pos && authorPrecedes(history.author, next.author))
    ) {
      next.pos += historyLen;
    }
    return normalizeOp(next);
  }

  if (next.type === "insert" && history.type === "delete") {
    const historyLen = history.to - history.from;
    if (history.to <= next.pos) {
      next.pos -= historyLen;
    } else if (next.pos >= history.from) {
      next.pos = history.from;
    }
    return normalizeOp(next);
  }

  if (next.type === "delete" && history.type === "insert") {
    const historyLen = history.value.length;
    if (history.pos <= next.from) {
      next.from += historyLen;
      next.to += historyLen;
    } else if (history.pos < next.to) {
      next.to += historyLen;
    }
    return normalizeOp(next);
  }

  if (next.type === "delete" && history.type === "delete") {
    const removedBefore = (pos: number) => {
      if (pos <= history.from) {
        return 0;
      }
      if (pos >= history.to) {
        return history.to - history.from;
      }
      return pos - history.from;
    };

    const newFrom = next.from - removedBefore(next.from);
    const newTo = next.to - removedBefore(next.to);
    next.from = Math.max(0, newFrom);
    next.to = Math.max(next.from, newTo);
  }

  return normalizeOp(next);
}

function transformConcurrentPair(
  pending: RopeOperation,
  incoming: RopeOperation,
): [RopeOperation | null, RopeOperation | null] {
  const rebasedPending = transformAgainstHistory(pending, incoming);
  const rebasedIncoming = transformAgainstHistory(incoming, pending);
  return [rebasedPending, rebasedIncoming];
}

function applyOpToText(baseText: string, op: RopeOperation): string {
  if (op.type === "insert") {
    const position = Math.max(0, Math.min(op.pos, baseText.length));
    return baseText.slice(0, position) + op.value + baseText.slice(position);
  }

  const from = Math.max(0, Math.min(op.from, baseText.length));
  const to = Math.max(from, Math.min(op.to, baseText.length));
  return baseText.slice(0, from) + baseText.slice(to);
}

export function useRopes(): [
  string,
  (ops: RopeOperation[]) => void,
  string,
  RopeOperation[],
  number,
  boolean,
] {
  const MAX_CURSOR_OPS = 300;
  const { socketRef, subscribe, editorSessionRef } = useWS();
  const initialState = useRef<EditorSessionState>(
    editorSessionRef.current,
  ).current;
  const textRef = useRef(initialState.text);
  const pendingOpsRef = useRef<RopeOperation[]>([]);
  const bufferedOpsRef = useRef<RopeOperation[]>([]);
  const serverVersionRef = useRef(initialState.serverVersion);
  const localUID = useRef(initialState.localUID);
  const hasInitialSyncRef = useRef(initialState.hasInitialSync);

  const [text, setText] = useState(initialState.text);
  const [outputText, setOutput] = useState(initialState.outputText);
  const [incomingOp, setIncomingOp] = useState<RopeOperation[]>([]);
  const [syncVersion, setSyncVersion] = useState(initialState.syncVersion);
  const [isSynced, setIsSynced] = useState(initialState.hasInitialSync);

  const setSnapshotText = useCallback(
    (newText: string) => {
      textRef.current = newText;
      editorSessionRef.current.text = newText;
      pendingOpsRef.current = [];
      setText(newText);
      setSyncVersion((value) => {
        const next = value + 1;
        editorSessionRef.current.syncVersion = next;
        return next;
      });
    },
    [editorSessionRef],
  );

  const queueRemoteOp = useCallback((op: RopeOperation) => {
    setIncomingOp((oldArray) => {
      const next = [...oldArray, op];
      return next.length > MAX_CURSOR_OPS
        ? next.slice(next.length - MAX_CURSOR_OPS)
        : next;
    });
  }, []);

  const rebaseIncomingAgainstPending = useCallback(
    (op: RopeOperation): RopeOperation | null => {
      let rebasedIncoming: RopeOperation | null = cloneOp(op);
      const nextPending: RopeOperation[] = [];

      for (const pending of pendingOpsRef.current) {
        if (!rebasedIncoming) {
          nextPending.push(pending);
          continue;
        }

        const [rebasedPending, nextIncoming] = transformConcurrentPair(
          pending,
          rebasedIncoming,
        );
        if (rebasedPending) {
          nextPending.push(rebasedPending);
        }
        rebasedIncoming = nextIncoming;
      }

      pendingOpsRef.current = nextPending;
      return rebasedIncoming;
    },
    [],
  );

  const sendOperation = useCallback(
    (op: RopeOperation) => {
      const ws = socketRef.current;
      if (
        !hasInitialSyncRef.current ||
        !ws ||
        ws.readyState !== WebSocket.OPEN
      ) {
        bufferedOpsRef.current.push(cloneOp(op));
        return;
      }

      const outbound = cloneOp(op);
      outbound.version =
        serverVersionRef.current + pendingOpsRef.current.length;
      outbound.author = localUID.current;
      pendingOpsRef.current.push(outbound);
      ws.send(JSON.stringify(outbound));
    },
    [socketRef],
  );

  const flushBufferedOperations = useCallback(() => {
    const ws = socketRef.current;
    if (!hasInitialSyncRef.current || !ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const bufferedOps = bufferedOpsRef.current;
    if (bufferedOps.length === 0) {
      return;
    }
    bufferedOpsRef.current = [];

    for (const op of bufferedOps) {
      sendOperation(op);
    }
  }, [sendOperation, socketRef]);

  const submitLocalOps = useCallback(
    (ops: RopeOperation[]) => {
      if (ops.length === 0) {
        return;
      }

      let nextText = textRef.current;
      for (const op of ops) {
        nextText = applyOpToText(nextText, op);
        sendOperation(op);
      }
      textRef.current = nextText;
      editorSessionRef.current.text = nextText;
      setText(nextText);
      flushBufferedOperations();
    },
    [editorSessionRef, flushBufferedOperations, sendOperation],
  );

  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      const data = JSON.parse(event.data);

      switch (data.event) {
        case "input_update": {
          const inputOp = data.update as RopeOperation;
          if (typeof inputOp?.version === "number") {
            serverVersionRef.current = Math.max(
              serverVersionRef.current,
              inputOp.version,
            );
            editorSessionRef.current.serverVersion = serverVersionRef.current;
          }

          const isRemoteInput =
            typeof inputOp.author === "number"
              ? inputOp.author !== localUID.current
              : true;
          if (!isRemoteInput) {
            break;
          }

          const rebasedOp = rebaseIncomingAgainstPending(inputOp);
          if (!rebasedOp) {
            break;
          }

          textRef.current = applyOpToText(textRef.current, rebasedOp);
          editorSessionRef.current.text = textRef.current;
          setText(textRef.current);
          queueRemoteOp(rebasedOp);
          break;
        }
        case "version_mismatch_update": {
          const mismatchOp = data.update as RopeOperation;
          const isRemoteMismatch =
            typeof mismatchOp.author === "number"
              ? mismatchOp.author !== localUID.current
              : true;
          if (!isRemoteMismatch) {
            if (typeof mismatchOp?.version === "number") {
              serverVersionRef.current = mismatchOp.version;
              editorSessionRef.current.serverVersion = serverVersionRef.current;
            }
            break;
          }

          if (typeof mismatchOp?.version === "number") {
            serverVersionRef.current = Math.max(
              serverVersionRef.current,
              mismatchOp.version,
            );
            editorSessionRef.current.serverVersion = serverVersionRef.current;
          }

          const rebasedOp = rebaseIncomingAgainstPending(mismatchOp);
          if (!rebasedOp) {
            break;
          }

          textRef.current = applyOpToText(textRef.current, rebasedOp);
          editorSessionRef.current.text = textRef.current;
          setText(textRef.current);
          queueRemoteOp(rebasedOp);
          break;
        }
        case "version_ack": {
          if (pendingOpsRef.current.length > 0) {
            pendingOpsRef.current = pendingOpsRef.current.slice(1);
          }
          if (typeof data.update?.version === "number") {
            serverVersionRef.current = Math.max(
              serverVersionRef.current,
              data.update.version,
            );
            editorSessionRef.current.serverVersion = serverVersionRef.current;
          }
          flushBufferedOperations();
          break;
        }
        case "output_update":
          editorSessionRef.current.outputText = data.update;
          setOutput(data.update);
          break;
        case "connection_update": {
          if (typeof data.update.version === "number") {
            serverVersionRef.current = data.update.version;
            editorSessionRef.current.serverVersion = data.update.version;
          }
          if (typeof data.update.uid === "number") {
            localUID.current = data.update.uid;
            editorSessionRef.current.localUID = data.update.uid;
          }
          if (typeof data.update.text === "string") {
            setIncomingOp([]);
            setSnapshotText(data.update.text);
          }
          hasInitialSyncRef.current = true;
          editorSessionRef.current.hasInitialSync = true;
          setIsSynced(true);
          flushBufferedOperations();
          break;
        }
        case "resync_update": {
          if (typeof data.update?.text === "string") {
            setIncomingOp([]);
            setSnapshotText(data.update.text);
          }
          if (typeof data.update?.version === "number") {
            serverVersionRef.current = data.update.version;
            editorSessionRef.current.serverVersion = data.update.version;
          }
          hasInitialSyncRef.current = true;
          editorSessionRef.current.hasInitialSync = true;
          setIsSynced(true);
          flushBufferedOperations();
          break;
        }
        default:
          break;
      }
    });

    return unsubscribe;
  }, [
    editorSessionRef,
    flushBufferedOperations,
    queueRemoteOp,
    rebaseIncomingAgainstPending,
    setSnapshotText,
    subscribe,
  ]);

  return [text, submitLocalOps, outputText, incomingOp, syncVersion, isSynced];
}
