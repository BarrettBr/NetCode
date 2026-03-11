import {
  EMPTY_ACTIVE_IDS,
  EMPTY_TABS,
  nextActiveId,
  normalizeTabs,
  sanitizeTerminalText,
  type ActiveTerminalIds,
  type ServerTerminalTab,
  type TerminalCollection,
  type TerminalScope,
  type TerminalStatus,
} from "@/lib/workspaceTerminal";

export type WorkspaceTerminalState = {
  tabs: TerminalCollection;
  activeTabIds: ActiveTerminalIds;
};

export function createEmptyWorkspaceTerminalState(): WorkspaceTerminalState {
  return {
    tabs: EMPTY_TABS,
    activeTabIds: EMPTY_ACTIVE_IDS,
  };
}

export function applyTerminalSnapshot(
  state: WorkspaceTerminalState,
  update: {
    privateTabs?: ServerTerminalTab[];
    sharedTabs?: ServerTerminalTab[];
  },
): WorkspaceTerminalState {
  const tabs: TerminalCollection = {
    private: normalizeTabs("private", update.privateTabs, state.tabs.private),
    shared: normalizeTabs("shared", update.sharedTabs, state.tabs.shared),
  };

  return {
    tabs,
    activeTabIds: {
      private: nextActiveId(tabs.private, state.activeTabIds.private),
      shared: nextActiveId(tabs.shared, state.activeTabIds.shared),
    },
  };
}

export function applyTerminalCreated(
  state: WorkspaceTerminalState,
  scope: TerminalScope,
  serverTab: ServerTerminalTab,
): WorkspaceTerminalState {
  const nextScopeTabs = normalizeTabs(
    scope,
    [
      ...state.tabs[scope],
      {
        id: serverTab.id,
        scope,
        status: serverTab.status ?? "idle",
        buffer: sanitizeTerminalText(serverTab.buffer ?? ""),
        title: "",
        commandDraft: "",
      },
    ],
    state.tabs[scope],
  );

  return {
    tabs: {
      ...state.tabs,
      [scope]: nextScopeTabs,
    },
    activeTabIds: {
      ...state.activeTabIds,
      [scope]: state.activeTabIds[scope] ?? serverTab.id,
    },
  };
}

export function appendTerminalOutput(
  state: WorkspaceTerminalState,
  scope: TerminalScope,
  terminalId: string,
  chunk: string,
): WorkspaceTerminalState {
  return {
    ...state,
    tabs: {
      ...state.tabs,
      [scope]: state.tabs[scope].map((tab) =>
        tab.id === terminalId
          ? {
              ...tab,
              status: "running",
              buffer: `${tab.buffer}${chunk}`,
            }
          : tab,
      ),
    },
  };
}

export function setTerminalStatus(
  state: WorkspaceTerminalState,
  scope: TerminalScope,
  terminalId: string,
  status: TerminalStatus,
): WorkspaceTerminalState {
  return {
    ...state,
    tabs: {
      ...state.tabs,
      [scope]: state.tabs[scope].map((tab) =>
        tab.id === terminalId ? { ...tab, status } : tab,
      ),
    },
  };
}

export function applyTerminalDraft(
  state: WorkspaceTerminalState,
  scope: TerminalScope,
  terminalId: string,
  draft: string,
): WorkspaceTerminalState {
  return {
    ...state,
    tabs: {
      ...state.tabs,
      [scope]: state.tabs[scope].map((tab) =>
        tab.id === terminalId ? { ...tab, commandDraft: draft } : tab,
      ),
    },
  };
}

export function applyTerminalClosed(
  state: WorkspaceTerminalState,
  scope: TerminalScope,
  terminalId: string,
): WorkspaceTerminalState {
  const remaining = state.tabs[scope]
    .filter((tab) => tab.id !== terminalId)
    .map((tab, index) => ({ ...tab, title: `${index + 1}` }));

  return {
    tabs: {
      ...state.tabs,
      [scope]: remaining,
    },
    activeTabIds: {
      ...state.activeTabIds,
      [scope]: nextActiveId(
        remaining,
        state.activeTabIds[scope] === terminalId
          ? null
          : state.activeTabIds[scope],
      ),
    },
  };
}

export function setActiveTerminalTab(
  state: WorkspaceTerminalState,
  scope: TerminalScope,
  terminalId: string,
): WorkspaceTerminalState {
  return {
    ...state,
    activeTabIds: {
      ...state.activeTabIds,
      [scope]: terminalId,
    },
  };
}

export function submitTerminalCommand(
  state: WorkspaceTerminalState,
  scope: TerminalScope,
  terminalId: string,
) {
  const tab = state.tabs[scope].find((candidate) => candidate.id === terminalId);
  const command = tab?.commandDraft ?? "";

  if (!command.trim()) {
    return null;
  }

  return {
    command,
    nextState: {
      ...state,
      tabs: {
        ...state.tabs,
        [scope]: state.tabs[scope].map((candidate) =>
          candidate.id === terminalId
            ? { ...candidate, status: "running", commandDraft: "" }
            : candidate,
        ),
      },
    } satisfies WorkspaceTerminalState,
  };
}
