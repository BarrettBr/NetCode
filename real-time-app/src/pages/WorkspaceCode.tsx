import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ChevronDown,
  ChevronRight,
  EyeOff,
  Plus,
  TerminalSquare,
  X,
} from "lucide-react";
import Textbox from "@/components/textbox";
import { useRopes } from "@/hooks/useRopes";
import {
  useWorkspaceTerminal,
  type TerminalScope,
} from "@/hooks/useWorkspaceTerminal";
import {
  DEFAULT_EDITOR_SETTINGS,
  type EditorSettings,
} from "@/lib/editorSettings";

type Props = {
  editorSettings?: EditorSettings;
};

type DockPosition = EditorSettings["terminalDock"];

const MIN_TERMINAL_PX = 180;
const MAX_TERMINAL_PERCENT = 60;
const DEFAULT_TERMINAL_SIZE: Record<DockPosition, number> = {
  bottom: 34,
  right: 42,
};

type ResizeState = {
  dock: DockPosition;
} | null;

function clampTerminalPercent(
  value: number,
  availablePx: number
): number {
  if (!Number.isFinite(value) || availablePx <= 0) {
    return 34;
  }

  const minPercent = Math.min(MAX_TERMINAL_PERCENT, (MIN_TERMINAL_PX / availablePx) * 100);
  return Math.min(MAX_TERMINAL_PERCENT, Math.max(minPercent, value));
}

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

  const [isTerminalVisible, setIsTerminalVisible] = useState(true);
  const [terminalSize, setTerminalSize] =
    useState<Record<DockPosition, number>>(DEFAULT_TERMINAL_SIZE);
  const [resizeState, setResizeState] = useState<ResizeState>(null);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const terminalPaneRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const autoCreateRef = useRef(false);
  const dock = editorSettings.terminalDock;

  useEffect(() => {
    if (!activeTab) {
      return;
    }
    outputRef.current?.scrollTo({
      top: outputRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [activeTab?.buffer, activeTab?.id]);

  useEffect(() => {
    if (!activeTab || !isTerminalVisible) {
      return;
    }

    const pane = terminalPaneRef.current;
    if (!pane) {
      return;
    }

    const rect = pane.getBoundingClientRect();
    const estimatedCols = Math.max(40, Math.floor((rect.width - 32) / 8.2));
    const estimatedRows = Math.max(12, Math.floor((rect.height - 140) / 24));
    resizeTerminal(activeScope, activeTab.id, estimatedCols, estimatedRows);
  }, [
    activeScope,
    activeTab,
    dock,
    isTerminalVisible,
    resizeTerminal,
    terminalSize,
  ]);

  useEffect(() => {
    if (autoCreateRef.current || !socketReady) {
      return;
    }
    if (tabs.private.length === 0 && tabs.shared.length === 0) {
      autoCreateRef.current = true;
      createTerminal();
    }
  }, [createTerminal, socketReady, tabs.private.length, tabs.shared.length]);

  useEffect(() => {
    if (!resizeState) {
      return;
    }

    const handlePointerMove = (event: MouseEvent) => {
      const surface = surfaceRef.current;
      if (!surface) {
        return;
      }

      const rect = surface.getBoundingClientRect();
      const availablePx = resizeState.dock === "bottom" ? rect.height : rect.width;
      if (availablePx <= 0) {
        return;
      }

      const nextPercent =
        resizeState.dock === "bottom"
          ? ((rect.bottom - event.clientY) / rect.height) * 100
          : ((rect.right - event.clientX) / rect.width) * 100;

      setTerminalSize((prev) => ({
        ...prev,
        [resizeState.dock]: clampTerminalPercent(nextPercent, availablePx),
      }));
    };

    const handlePointerUp = () => {
      setResizeState(null);
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, [resizeState]);

  const scopeTabs = tabs[activeScope];
  const activeTabId = activeTabIds[activeScope];

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeTab) {
      return;
    }
    runCommand(activeScope, activeTab.id);
  };

  const renderTerminalPane = () => (
    <div
      ref={terminalPaneRef}
      className={`relative flex min-h-0 min-w-0 flex-col overflow-hidden border-Cborder bg-[#041015] ${
        dock === "bottom" ? "border-t" : "border-l"
      }`}
      style={{
        [dock === "bottom" ? "height" : "width"]: `${terminalSize[dock]}%`,
      }}
    >
      <button
        type="button"
        aria-label="Resize terminal"
        onMouseDown={() => setResizeState({ dock })}
        className={`absolute z-20 ${
          dock === "bottom"
            ? "left-0 right-0 top-0 h-2 cursor-row-resize"
            : "bottom-0 left-0 top-0 w-2 cursor-col-resize"
        }`}
      >
        <span
          className={`absolute bg-Cborder/70 transition hover:bg-accent ${
            dock === "bottom"
              ? "left-0 right-0 top-1/2 h-px -translate-y-1/2"
              : "bottom-0 left-1/2 top-0 w-px -translate-x-1/2"
          }`}
        />
      </button>

      <div className="flex items-center gap-3 border-b border-Cborder px-4 py-3">
        <div className="flex items-center gap-2 text-white/75">
          <TerminalSquare className="h-4 w-4 text-accent" />
          <span className="text-sm text-white/85">terminal</span>
        </div>

        <div className="flex rounded-full border border-Cborder/80 bg-panel/50 p-1 text-sm">
          {(["private", "shared"] as TerminalScope[]).map((scope) => {
            const active = activeScope === scope;
            return (
              <button
                key={scope}
                type="button"
                onClick={() => setActiveScope(scope)}
                className={`rounded-full px-3 py-1.5 transition ${
                  active
                    ? "bg-light-panel text-white"
                    : "text-white/45 hover:text-white/75"
                }`}
              >
                {scope === "private" ? "Private" : "Shared"}
              </button>
            );
          })}
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex min-w-max items-center gap-2">
            {scopeTabs.map((tab, index) => {
              const active = activeTabId === tab.id;
              return (
                <div
                  key={tab.id}
                  className={`flex items-center rounded-lg border px-1 transition ${
                    active
                      ? "border-accent/60 bg-light-panel text-white"
                      : "border-Cborder/70 bg-panel/40 text-white/55 hover:text-white/75"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab(activeScope, tab.id)}
                    className="px-2.5 py-1.5 text-sm"
                  >
                    {index + 1}
                  </button>
                  <button
                    type="button"
                    aria-label={`Close terminal ${index + 1}`}
                    onClick={() => closeTerminal(activeScope, tab.id)}
                    className="px-1.5 text-white/30 transition hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={createTerminal}
          className="rounded-lg border border-Cborder/70 bg-panel/40 p-2 text-white/55 transition hover:border-accent/40 hover:text-white"
          aria-label="Create terminal"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setIsTerminalVisible(false)}
          className="rounded-lg border border-Cborder/70 bg-panel/40 p-2 text-white/45 transition hover:text-white"
          aria-label="Hide terminal"
        >
          <EyeOff className="h-3.5 w-3.5" />
        </button>
        <div className="ml-1 flex items-center gap-2 text-xs text-white/35">
          <span
            className={`h-2 w-2 rounded-full ${
              socketReady ? "bg-accent" : "bg-white/20"
            }`}
          />
          <span>{socketReady ? "connected" : "connecting"}</span>
        </div>
      </div>

      {activeTab ? (
        <>
          <div
            ref={outputRef}
            className="min-h-0 flex-1 overflow-y-auto bg-[#02090c] px-4 py-4 font-fira text-[13px] leading-6 text-white/78"
          >
            <pre className="whitespace-pre-wrap break-words">
              {activeTab.buffer || "netcode:$ "}
            </pre>
          </div>
          <div className="border-t border-Cborder px-4 py-3">
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-3 font-fira text-sm"
            >
              <span className="text-accent/90">netcode:$</span>
              <input
                value={activeTab.commandDraft}
                onChange={(event) =>
                  updateDraft(activeScope, activeTab.id, event.target.value)
                }
                autoComplete="off"
                spellCheck={false}
                placeholder="type a command"
                className="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-white/25"
              />
            </form>
          </div>
        </>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6">
          <div className="max-w-sm text-center">
            <p className="text-lg text-white">No {activeScope} terminals yet.</p>
            <p className="mt-2 text-sm leading-7 text-white/45">
              Create a new terminal to start running commands inside the workspace.
            </p>
            <button
              type="button"
              onClick={createTerminal}
              className="mt-5 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm text-white transition hover:bg-accent/20"
            >
              New terminal
            </button>
          </div>
        </div>
      )}
    </div>
  );

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
          renderTerminalPane()
        ) : (
          <button
            type="button"
            onClick={() => setIsTerminalVisible(true)}
            className={`absolute z-20 rounded-full border border-Cborder bg-panel/95 p-2 text-white/55 shadow-[0_10px_28px_rgba(0,0,0,0.35)] transition hover:text-white ${
              dock === "bottom"
                ? "bottom-4 right-4"
                : "right-4 top-1/2 -translate-y-1/2"
            }`}
            aria-label="Show terminal"
          >
            {dock === "bottom" ? (
              <ChevronUpIcon />
            ) : (
              <ChevronLeftIcon />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function ChevronUpIcon() {
  return <ChevronDown className="h-4 w-4 rotate-180" />;
}

function ChevronLeftIcon() {
  return <ChevronRight className="h-4 w-4 rotate-180" />;
}
