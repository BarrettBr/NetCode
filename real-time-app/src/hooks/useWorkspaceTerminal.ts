import { useEffect, useMemo, useRef, useState } from "react";
import { AppConfig } from "@/config";

export type TerminalScope = "private" | "shared";
export type TerminalStatus = "idle" | "running" | "closed";

export type TerminalTab = {
  id: string;
  scope: TerminalScope;
  title: string;
  status: TerminalStatus;
  buffer: string;
  commandDraft: string;
};

type ServerTerminalTab = {
  id: string;
  scope: TerminalScope;
  status?: TerminalStatus;
  buffer?: string;
};

type TerminalCollection = Record<TerminalScope, TerminalTab[]>;
type ActiveTerminalIds = Record<TerminalScope, string | null>;

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

const EMPTY_TABS: TerminalCollection = {
  private: [],
  shared: [],
};

const EMPTY_ACTIVE_IDS: ActiveTerminalIds = {
  private: null,
  shared: null,
};

function sanitizeTerminalText(value: string): string {
  return value
    .replace(/\u001b\][^\u0007]*\u0007/g, "")
    .replace(/\u001b\][^\u001b]*\u001b\\/g, "")
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\u001b[@-_]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "");
}

function normalizeTabs(
  scope: TerminalScope,
  incoming: ServerTerminalTab[] | undefined,
  previous: TerminalTab[]
): TerminalTab[] {
  const prevById = new Map(previous.map((tab) => [tab.id, tab]));

  return (incoming ?? []).map((tab, index) => {
    const existing = prevById.get(tab.id);
    return {
      id: tab.id,
      scope,
      title: `${index + 1}`,
      status: tab.status ?? existing?.status ?? "idle",
      buffer: sanitizeTerminalText(tab.buffer ?? existing?.buffer ?? ""),
      commandDraft: existing?.commandDraft ?? "",
    };
  });
}

function nextActiveId(tabs: TerminalTab[], preferredId: string | null) {
  if (preferredId && tabs.some((tab) => tab.id === preferredId)) {
    return preferredId;
  }
  return tabs[0]?.id ?? null;
}

export function useWorkspaceTerminal(): UseWorkspaceTerminalResult {
  const [socketReady, setSocketReady] = useState(false);
  const [activeScope, setActiveScope] = useState<TerminalScope>("private");
  const [tabs, setTabs] = useState<TerminalCollection>(EMPTY_TABS);
  const [activeTabIds, setActiveTabIds] =
    useState<ActiveTerminalIds>(EMPTY_ACTIVE_IDS);

  const socketRef = useRef<WebSocket | null>(null);
  const idleTimersRef = useRef<Record<string, number>>({});

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
          setTabs((prev) => {
            const nextTabs: TerminalCollection = {
              private: normalizeTabs(
                "private",
                data.update?.privateTabs as ServerTerminalTab[] | undefined,
                prev.private
              ),
              shared: normalizeTabs(
                "shared",
                data.update?.sharedTabs as ServerTerminalTab[] | undefined,
                prev.shared
              ),
            };
            setActiveTabIds((prevActive) => ({
              private: nextActiveId(nextTabs.private, prevActive.private),
              shared: nextActiveId(nextTabs.shared, prevActive.shared),
            }));
            return nextTabs;
          });
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

          setTabs((prev) => {
            const nextScopeTabs = normalizeTabs(scope, [...prev[scope], {
              id: serverTab.id,
              scope,
              status: serverTab.status ?? "idle",
              buffer: sanitizeTerminalText(serverTab.buffer ?? ""),
              title: "",
              commandDraft: "",
            }], prev[scope]);

            const nextTabs = {
              ...prev,
              [scope]: nextScopeTabs,
            };

            setActiveTabIds((prevActive) => ({
              ...prevActive,
              [scope]: prevActive[scope] ?? serverTab.id,
            }));
            return nextTabs;
          });
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
            typeof update?.chunk === "string" ? update.chunk : ""
          );

          setTabs((prev) => {
            const nextScopeTabs = prev[scope].map((tab) =>
              tab.id === terminalId
                ? {
                    ...tab,
                    status: "running",
                    buffer: `${tab.buffer}${chunk}`,
                  }
                : tab
            );
            return {
              ...prev,
              [scope]: nextScopeTabs,
            };
          });

          const timerKey = `${scope}:${terminalId}`;
          if (idleTimersRef.current[timerKey]) {
            window.clearTimeout(idleTimersRef.current[timerKey]);
          }
          idleTimersRef.current[timerKey] = window.setTimeout(() => {
            setTabs((prev) => ({
              ...prev,
              [scope]: prev[scope].map((tab) =>
                tab.id === terminalId ? { ...tab, status: "idle" } : tab
              ),
            }));
          }, 400);
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

          setTabs((prev) => {
            const remaining = prev[scope]
              .filter((tab) => tab.id !== terminalId)
              .map((tab, index) => ({ ...tab, title: `${index + 1}` }));
            setActiveTabIds((prevActive) => ({
              ...prevActive,
              [scope]: nextActiveId(remaining, prevActive[scope] === terminalId ? null : prevActive[scope]),
            }));
            return {
              ...prev,
              [scope]: remaining,
            };
          });
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
    const activeId = activeTabIds[activeScope];
    if (!activeId) {
      return null;
    }
    return tabs[activeScope].find((tab) => tab.id === activeId) ?? null;
  }, [activeScope, activeTabIds, tabs]);

  const sendMessage = (payload: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(JSON.stringify(payload));
  };

  const createTerminal = () => {
    sendMessage({
      event: "terminal_create",
      scope: activeScope,
    });
  };

  const closeTerminal = (scope: TerminalScope, terminalId: string) => {
    sendMessage({
      event: "terminal_close",
      scope,
      terminalId,
    });
  };

  const setActiveTab = (scope: TerminalScope, terminalId: string) => {
    setActiveTabIds((prev) => ({
      ...prev,
      [scope]: terminalId,
    }));
  };

  const updateDraft = (
    scope: TerminalScope,
    terminalId: string,
    draft: string
  ) => {
    setTabs((prev) => ({
      ...prev,
      [scope]: prev[scope].map((tab) =>
        tab.id === terminalId ? { ...tab, commandDraft: draft } : tab
      ),
    }));
  };

  const runCommand = (scope: TerminalScope, terminalId: string) => {
    const tab = tabs[scope].find((candidate) => candidate.id === terminalId);
    const command = tab?.commandDraft ?? "";
    if (!command.trim()) {
      return;
    }

    setTabs((prev) => ({
      ...prev,
      [scope]: prev[scope].map((candidate) =>
        candidate.id === terminalId
          ? { ...candidate, status: "running", commandDraft: "" }
          : candidate
      ),
    }));

    sendMessage({
      event: "terminal_run",
      scope,
      terminalId,
      command,
    });
  };

  const resizeTerminal = (
    scope: TerminalScope,
    terminalId: string,
    cols: number,
    rows: number
  ) => {
    sendMessage({
      event: "terminal_resize",
      scope,
      terminalId,
      cols: Math.max(1, Math.round(cols)),
      rows: Math.max(1, Math.round(rows)),
    });
  };

  return {
    socketReady,
    activeScope,
    setActiveScope,
    tabs,
    activeTabIds,
    activeTab,
    createTerminal,
    closeTerminal,
    setActiveTab,
    updateDraft,
    runCommand,
    resizeTerminal,
  };
}
