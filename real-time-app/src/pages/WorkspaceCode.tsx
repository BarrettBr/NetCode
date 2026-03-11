import { useEffect, useRef } from "react";
import Textbox from "@/features/editor/components/Textbox";
import {
  WorkspaceTerminalPane,
  WorkspaceTerminalRevealButton,
} from "@/features/workspace/components/terminal/WorkspaceTerminalPane";
import { useRopes } from "@/hooks/useRopes";
import { useWorkspaceTerminal } from "@/hooks/useWorkspaceTerminal";
import { useWorkspaceTerminalLayout } from "@/hooks/useWorkspaceTerminalLayout";
import {
  DEFAULT_EDITOR_SETTINGS,
  type EditorSettings,
} from "@/lib/editorSettings";

type Props = {
  editorSettings?: EditorSettings;
};

export default function WorkspaceCode({
  editorSettings = DEFAULT_EDITOR_SETTINGS,
}: Props) {
  const [text, updateText, , incomingOp, syncVersion, isSynced] = useRopes();
  const {
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
  } = useWorkspaceTerminal();
  const autoCreateRef = useRef(false);
  const dock = editorSettings.terminalDock;
  const {
    isTerminalVisible,
    setIsTerminalVisible,
    terminalSize,
    setResizeState,
    surfaceRef,
    terminalPaneRef,
    outputRef,
    commandInputRef,
  } = useWorkspaceTerminalLayout({
    dock,
    activeScope,
    activeTab,
    resizeTerminal,
  });

  useEffect(() => {
    if (autoCreateRef.current || !socketReady) {
      return;
    }
    if (tabs.private.length === 0 && tabs.shared.length === 0) {
      autoCreateRef.current = true;
      createTerminal();
    }
  }, [createTerminal, socketReady, tabs.private.length, tabs.shared.length]);

  const scopeTabs = tabs[activeScope];
  const activeTabId = activeTabIds[activeScope];

  return (
    <div className="flex h-[calc(100vh-70px)] flex-col p-4">
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-accent/70">
            Advanced workspace
          </p>
          <h1 className="mt-1 text-2xl text-white">Code + terminal</h1>
        </div>
        <div className="text-right text-xs text-white/35">
          <p>Shared editor</p>
          <p>{dock === "bottom" ? "Terminal below" : "Terminal right"}</p>
        </div>
      </div>

      <div
        ref={surfaceRef}
        className={`relative flex min-h-0 flex-1 overflow-hidden rounded-[28px] border border-Cborder bg-[#030a0d] ${
          dock === "right" ? "flex-row" : "flex-col"
        }`}
      >
        <div className="min-h-0 min-w-0 flex-1">
          <Textbox
            curText={text}
            setText={updateText}
            incomingOp={incomingOp}
            syncVersion={syncVersion}
            isSynced={isSynced}
            editorSettings={editorSettings}
            id="workspaceInput"
          />
        </div>

        {isTerminalVisible ? (
          <WorkspaceTerminalPane
            dock={dock}
            socketReady={socketReady}
            activeScope={activeScope}
            scopeTabs={scopeTabs}
            activeTabId={activeTabId}
            activeTab={activeTab}
            terminalSize={terminalSize[dock]}
            paneRef={terminalPaneRef}
            outputRef={outputRef}
            commandInputRef={commandInputRef}
            onResizeStart={() => setResizeState({ dock })}
            onCreateTerminal={createTerminal}
            onHideTerminal={() => setIsTerminalVisible(false)}
            onSetActiveScope={setActiveScope}
            onSetActiveTab={setActiveTab}
            onCloseTerminal={closeTerminal}
            onUpdateDraft={updateDraft}
            onRunCommand={runCommand}
          />
        ) : (
          <WorkspaceTerminalRevealButton
            dock={dock}
            onClick={() => setIsTerminalVisible(true)}
          />
        )}
      </div>
    </div>
  );
}
