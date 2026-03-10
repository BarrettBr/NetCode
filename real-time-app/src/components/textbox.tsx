import { useEffect, useRef } from "react";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  insertNewlineAndIndent,
} from "@codemirror/commands";
import type { RopeOperation } from "@/hooks/useRopes";

declare global {
  interface Window {
    __NETCODE_EDITOR_EVENTS__?: Array<{
      id: string;
      kind: string;
      text: string;
    }>;
  }
}

type Props = {
  curText: string;
  setText: (ops: RopeOperation[]) => void;
  incomingOp: RopeOperation[];
  syncVersion: number;
  isSynced: boolean;
  id: string;
};

function Textbox({
  curText,
  setText,
  incomingOp,
  syncVersion,
  isSynced,
  id,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const suppressDispatchRef = useRef(false);
  const processedIncomingOps = useRef(0);
  const submitOpsRef = useRef(setText);
  const editableCompartmentRef = useRef(new Compartment());

  const applyOpToText = (baseText: string, op: RopeOperation) => {
    if (op.type === "insert") {
      const position = Math.max(0, Math.min(op.pos, baseText.length));
      return baseText.slice(0, position) + op.value + baseText.slice(position);
    }

    const from = Math.max(0, Math.min(op.from, baseText.length));
    const to = Math.max(from, Math.min(op.to, baseText.length));
    return baseText.slice(0, from) + baseText.slice(to);
  };

  const publishDocText = (docText: string) => {
    if (typeof window === "undefined") {
      return;
    }
    hostRef.current?.setAttribute("data-editor-text", docText);
  };

  const publishEvent = (kind: string, docText: string) => {
    if (typeof window === "undefined") {
      return;
    }
    window.__NETCODE_EDITOR_EVENTS__ = window.__NETCODE_EDITOR_EVENTS__ ?? [];
    window.__NETCODE_EDITOR_EVENTS__.push({ id, kind, text: docText });
  };

  const buildOpsFromDiff = (
    previousText: string,
    nextText: string
  ): RopeOperation[] => {
    if (previousText === nextText) {
      return [];
    }

    let start = 0;
    while (
      start < previousText.length &&
      start < nextText.length &&
      previousText[start] === nextText[start]
    ) {
      start++;
    }

    let previousEnd = previousText.length;
    let nextEnd = nextText.length;
    while (
      previousEnd > start &&
      nextEnd > start &&
      previousText[previousEnd - 1] === nextText[nextEnd - 1]
    ) {
      previousEnd--;
      nextEnd--;
    }

    const ops: RopeOperation[] = [];
    if (previousEnd > start) {
      ops.push({
        event: "text_update",
        type: "delete",
        from: start,
        to: previousEnd,
        version: 0,
        author: 0,
      });
    }

    if (nextEnd > start) {
      ops.push({
        event: "text_update",
        type: "insert",
        pos: start,
        value: nextText.slice(start, nextEnd),
        version: 0,
        author: 0,
      });
    }

    return ops;
  };

  useEffect(() => {
    submitOpsRef.current = setText;
  }, [setText]);

  useEffect(() => {
    if (!hostRef.current || viewRef.current) {
      return;
    }

    const editorTheme = EditorView.theme({
      "&": {
        height: "100%",
        backgroundColor: "#030a0d",
        color: "#d4d4d4",
        fontFamily: '"Fira Code", monospace',
        fontSize: "0.875rem",
      },
      ".cm-scroller": {
        overflow: "auto",
        fontFamily: '"Fira Code", monospace',
        lineHeight: "24px",
      },
      ".cm-content, .cm-gutterElement": {
        lineHeight: "24px",
      },
      ".cm-content": {
        padding: "12px 0",
        caretColor: "#d4d4d4",
        minHeight: "100%",
      },
      ".cm-line": {
        padding: "0 12px",
      },
      ".cm-gutters": {
        backgroundColor: "#030a0d",
        color: "#888",
        borderRight: "2px solid #213030",
      },
      ".cm-activeLine, .cm-activeLineGutter": {
        backgroundColor: "transparent",
      },
      ".cm-selectionBackground": {
        backgroundColor: "#244b5a !important",
      },
      "&.cm-focused": {
        outline: "none",
      },
      ".cm-cursor": {
        borderLeftColor: "#d4d4d4",
      },
      "&.cm-editor.cm-readonly .cm-content": {
        caretColor: "transparent",
      },
    });

    const extensions: Extension[] = [
      editableCompartmentRef.current.of(EditorView.editable.of(isSynced)),
      lineNumbers(),
      history(),
      drawSelection(),
      highlightActiveLine(),
      keymap.of([
        { key: "Enter", run: insertNewlineAndIndent },
        ...defaultKeymap,
        ...historyKeymap,
        indentWithTab,
      ]),
      EditorState.tabSize.of(4),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged || suppressDispatchRef.current) {
          return;
        }

        let ops: RopeOperation[] = [];
        let delta = 0;
        update.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
          const pos = fromA + delta;
          const deletedLen = toA - fromA;
          const insertedText = inserted.toString();

          if (deletedLen > 0) {
            ops.push({
              event: "text_update",
              type: "delete",
              from: pos,
              to: pos + deletedLen,
              version: 0,
              author: 0,
            });
          }

          if (insertedText.length > 0) {
            ops.push({
              event: "text_update",
              type: "insert",
              pos,
              value: insertedText,
              version: 0,
              author: 0,
            });
          }

          delta += insertedText.length - deletedLen;
        });

        const startSelection = update.startState.selection.main;
        const previousDocLen = update.startState.doc.length;
        const isSuspiciousReplaceAll =
          startSelection.empty &&
          ops.length >= 1 &&
          ops.some(
            (op) =>
              op.type === "delete" &&
              op.from === 0 &&
              op.to === previousDocLen &&
              previousDocLen > 1
          );

        if (isSuspiciousReplaceAll) {
          ops = buildOpsFromDiff(
            update.startState.doc.toString(),
            update.state.doc.toString()
          );
        }

        if (ops.length > 0) {
          publishDocText(update.state.doc.toString());
          publishEvent("local_update", update.state.doc.toString());
          submitOpsRef.current(ops);
        }
      }),
      editorTheme,
    ];

    viewRef.current = new EditorView({
      state: EditorState.create({
        doc: curText,
        extensions,
      }),
      parent: hostRef.current,
    });

    const view = viewRef.current;
    view.contentDOM.setAttribute("id", id);
    view.contentDOM.setAttribute("spellcheck", "false");
    view.contentDOM.setAttribute("autocorrect", "off");
    view.contentDOM.setAttribute("autocapitalize", "off");
    view.contentDOM.setAttribute("data-gramm", "false");
    publishDocText(view.state.doc.toString());
    publishEvent("mount", view.state.doc.toString());

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [id]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const startIdx = Math.min(processedIncomingOps.current, incomingOp.length);
    const pendingOps = incomingOp.slice(startIdx);
    if (pendingOps.length === 0) {
      return;
    }
    processedIncomingOps.current = incomingOp.length;

    const shouldMapSelection = view.hasFocus;
    const selection = view.state.selection.main;
    let anchor = selection.anchor;
    let head = selection.head;

    const mapPosition = (pos: number, op: RopeOperation) => {
      if (op.type === "insert") {
        return op.pos <= pos ? pos + op.value.length : pos;
      }
      if (op.to <= pos) {
        return pos - (op.to - op.from);
      }
      if (op.from < pos) {
        return op.from;
      }
      return pos;
    };

    suppressDispatchRef.current = true;
    try {
      let fallbackDoc = view.state.doc.toString();
      for (const op of pendingOps) {
        fallbackDoc = applyOpToText(fallbackDoc, op);
        if (op.type === "insert") {
          const from = Math.max(0, Math.min(op.pos, view.state.doc.length));
          view.dispatch({
            changes: {
              from,
              insert: op.value,
            },
          });
        } else {
          const from = Math.max(0, Math.min(op.from, view.state.doc.length));
          const to = Math.max(from, Math.min(op.to, view.state.doc.length));
          view.dispatch({
            changes: {
              from,
              to,
              insert: "",
            },
          });
        }
        if (shouldMapSelection) {
          anchor = mapPosition(anchor, op);
          head = mapPosition(head, op);
        }
      }

      if (shouldMapSelection) {
        const docLen = view.state.doc.length;
        view.dispatch({
          selection: {
            anchor: Math.max(0, Math.min(anchor, docLen)),
            head: Math.max(0, Math.min(head, docLen)),
          },
        });
      }
      publishDocText(view.state.doc.toString());
      publishEvent("remote_apply", view.state.doc.toString());
    } catch {
      const currentDoc = view.state.doc.toString();
      let fallbackDoc = currentDoc;
      for (const op of pendingOps) {
        fallbackDoc = applyOpToText(fallbackDoc, op);
      }
      view.dispatch({
        changes: {
          from: 0,
          to: currentDoc.length,
          insert: fallbackDoc,
        },
      });
      publishDocText(fallbackDoc);
      publishEvent("remote_fallback", fallbackDoc);
    } finally {
      suppressDispatchRef.current = false;
    }
  }, [incomingOp]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const currentDoc = view.state.doc.toString();
    if (currentDoc === curText) {
      return;
    }

    const selection = view.state.selection.main;

    suppressDispatchRef.current = true;
    try {
      view.dispatch({
        changes: {
          from: 0,
          to: currentDoc.length,
          insert: curText,
        },
        selection: {
          anchor: Math.min(selection.anchor, curText.length),
          head: Math.min(selection.head, curText.length),
        },
      });
      processedIncomingOps.current = incomingOp.length;
      publishDocText(curText);
      publishEvent("snapshot_replace", curText);
    } finally {
      suppressDispatchRef.current = false;
    }
  }, [syncVersion]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    view.dispatch({
      effects: editableCompartmentRef.current.reconfigure(
        EditorView.editable.of(isSynced)
      ),
    });
  }, [isSynced]);

  return (
    <div className="flex h-full min-h-0 flex-row overflow-hidden rounded border-2 border-[#213030] md:rounded-r-none">
      <div ref={hostRef} className="h-full w-full" />
    </div>
  );
}

export default Textbox;
