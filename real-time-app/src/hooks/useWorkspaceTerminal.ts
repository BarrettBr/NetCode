import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppConfig } from "@/config";
import {
  type ActiveTerminalIds,
  sanitizeTerminalText,
  type TerminalCollection,
  type TerminalScope,
  type ServerTerminalTab,
  type TerminalTab,
} from "@/lib/workspaceTerminal";
import {
  applyTerminalClosed,
  applyTerminalCreated,
  applyTerminalDraft,
  applyTerminalSnapshot,
  appendTerminalOutput,
  createEmptyWorkspaceTerminalState,
  setActiveTerminalTab,
  setTerminalStatus,
  submitTerminalCommand,
} from "@/hooks/workspaceTerminalState";
import type { WorkspaceTerminalState } from "@/hooks/workspaceTerminalState";

type UseWorkspaceTerminalResult = {
  socketReady: boolean;
  activeScope: TerminalScope;
  setActiveScope: (scope: TerminalScope) => void;
  tabs: TerminalCollection;
  activeTabIds: ActiveTerminalIds;
  activeTab: TerminalTab | null;
  createTerminal: () => void;
  closeTerminal: (scope: TerminalScope, terminalId: string) => void;
  setActiveTab: (scope: TerminalScope, terminalId: string) => void;
  updateDraft: (scope: TerminalScope, terminalId: string, draft: string) => void;
  runCommand: (scope: TerminalScope, terminalId: string) => void;
  resizeTerminal: (
    scope: TerminalScope,
    terminalId: string,
    cols: number,
    rows: number
  ) => void;
};

export function useWorkspaceTerminal(): UseWorkspaceTerminalResult {
  const [socketReady, setSocketReady] = useState(false);
  const [activeScope, setActiveScope] = useState<TerminalScope>("private");
  const [terminalState, setTerminalState] = useState<WorkspaceTerminalState>(
    createEmptyWorkspaceTerminalState,
  );

  const socketRef = useRef<WebSocket | null>(null);
  const idleTimersRef = useRef<Record<string, number>>({});

  const sendMessage = useCallback((payload: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(JSON.stringify(payload));
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const hostname = window.location.hostname;
    const port = window.location.protocol === "https:" ? "" : `:${AppConfig.port}`;
    const url = `${protocol}//${hostname}${port}/api/terminal/ws?room=${AppConfig.roomId}`;
    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setSocketReady(true);
      socket.send(JSON.stringify({ event: "terminal_bootstrap" }));
    });

    socket.addEventListener("close", () => {
      setSocketReady(false);
      socketRef.current = null;
    });

    socket.addEventListener("message", (event) => {
      const data = JSON.parse(event.data) as {
        event?: string;
        update?: Record<string, unknown>;
      };

      switch (data.event) {
        case "terminal_snapshot": {
          setTerminalState((prev) =>
            applyTerminalSnapshot(prev, {
              privateTabs: data.update?.privateTabs as
                | ServerTerminalTab[]
                | undefined,
              sharedTabs: data.update?.sharedTabs as
                | ServerTerminalTab[]
                | undefined,
            }),
          );
          break;
        }
        case "terminal_created": {
          const update = data.update as
            | { tab?: ServerTerminalTab; scope?: TerminalScope }
            | undefined;
          const scope = update?.scope;
          const serverTab = update?.tab;
          if (!scope || !serverTab) {
            break;
          }

          setTerminalState((prev) =>
            applyTerminalCreated(prev, scope, serverTab),
          );
          break;
        }
        case "terminal_output": {
          const update = data.update as
            | { scope?: TerminalScope; terminalId?: string; chunk?: string }
            | undefined;
          const scope = update?.scope;
          const terminalId = update?.terminalId;
          if (!scope || !terminalId) {
            break;
          }
          const chunk = sanitizeTerminalText(
            typeof update?.chunk === "string" ? update.chunk : "",
          );

          setTerminalState((prev) =>
            appendTerminalOutput(prev, scope, terminalId, chunk),
          );

          const timerKey = `${scope}:${terminalId}`;
          if (idleTimersRef.current[timerKey]) {
            window.clearTimeout(idleTimersRef.current[timerKey]);
          }
          idleTimersRef.current[timerKey] = window.setTimeout(() => {
            setTerminalState((prev) =>
              setTerminalStatus(prev, scope, terminalId, "idle"),
            );
          }, 400);
          break;
        }
        case "terminal_draft": {
          const update = data.update as
            | { scope?: TerminalScope; terminalId?: string; draft?: string }
            | undefined;
          const scope = update?.scope;
          const terminalId = update?.terminalId;
          if (!scope || !terminalId) {
            break;
          }

          setTerminalState((prev) =>
            applyTerminalDraft(
              prev,
              scope,
              terminalId,
              typeof update?.draft === "string" ? update.draft : "",
            ),
          );
          break;
        }
        case "terminal_closed": {
          const update = data.update as
            | { scope?: TerminalScope; terminalId?: string }
            | undefined;
          const scope = update?.scope;
          const terminalId = update?.terminalId;
          if (!scope || !terminalId) {
            break;
          }

          setTerminalState((prev) =>
            applyTerminalClosed(prev, scope, terminalId),
          );
          break;
        }
        case "terminal_error":
        default:
          break;
      }
    });

    return () => {
      Object.values(idleTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      idleTimersRef.current = {};
      socket.close();
    };
  }, []);

  const activeTab = useMemo(() => {
    const activeId = terminalState.activeTabIds[activeScope];
    if (!activeId) {
      return null;
    }
    return terminalState.tabs[activeScope].find((tab) => tab.id === activeId) ?? null;
  }, [activeScope, terminalState]);

  const createTerminal = useCallback(() => {
    sendMessage({
      event: "terminal_create",
      scope: activeScope,
    });
  }, [activeScope, sendMessage]);

  const closeTerminal = useCallback((scope: TerminalScope, terminalId: string) => {
    sendMessage({
      event: "terminal_close",
      scope,
      terminalId,
    });
  }, [sendMessage]);

  const setActiveTab = useCallback((scope: TerminalScope, terminalId: string) => {
    setTerminalState((prev) => setActiveTerminalTab(prev, scope, terminalId));
  }, []);

  const updateDraft = useCallback((
    scope: TerminalScope,
    terminalId: string,
    draft: string,
  ) => {
    setTerminalState((prev) => applyTerminalDraft(prev, scope, terminalId, draft));

    if (scope === "shared") {
      sendMessage({
        event: "terminal_draft",
        scope,
        terminalId,
        draft,
      });
    }
  }, [sendMessage]);

  const runCommand = useCallback((scope: TerminalScope, terminalId: string) => {
    const result = submitTerminalCommand(terminalState, scope, terminalId);
    if (!result) {
      return;
    }

    setTerminalState(result.nextState);

    sendMessage({
      event: "terminal_run",
      scope,
      terminalId,
      command: result.command,
    });
  }, [sendMessage, terminalState]);

  const resizeTerminal = useCallback((
    scope: TerminalScope,
    terminalId: string,
    cols: number,
    rows: number,
  ) => {
    sendMessage({
      event: "terminal_resize",
      scope,
      terminalId,
      cols: Math.max(1, Math.round(cols)),
      rows: Math.max(1, Math.round(rows)),
    });
  }, [sendMessage]);

  return {
    socketReady,
    activeScope,
    setActiveScope,
    tabs: terminalState.tabs,
    activeTabIds: terminalState.activeTabIds,
    activeTab,
    createTerminal,
    closeTerminal,
    setActiveTab,
    updateDraft,
    runCommand,
    resizeTerminal,
  };
}
