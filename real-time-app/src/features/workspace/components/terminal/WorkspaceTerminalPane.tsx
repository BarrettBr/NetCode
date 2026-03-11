import type { FormEvent, RefObject } from "react";
import {
  ChevronDown,
  ChevronRight,
  EyeOff,
  Plus,
  TerminalSquare,
  X,
} from "lucide-react";
import {
  splitTerminalBuffer,
  type TerminalScope,
  type TerminalTab,
} from "@/lib/workspaceTerminal";
import type { DockPosition } from "@/hooks/useWorkspaceTerminalLayout";

type WorkspaceTerminalPaneProps = {
  dock: DockPosition;
  socketReady: boolean;
  activeScope: TerminalScope;
  scopeTabs: TerminalTab[];
  activeTabId: string | null;
  activeTab: TerminalTab | null;
  terminalSize: number;
  paneRef: RefObject<HTMLDivElement | null>;
  outputRef: RefObject<HTMLDivElement | null>;
  commandInputRef: RefObject<HTMLInputElement | null>;
  onResizeStart: () => void;
  onCreateTerminal: () => void;
  onHideTerminal: () => void;
  onSetActiveScope: (scope: TerminalScope) => void;
  onSetActiveTab: (scope: TerminalScope, terminalId: string) => void;
  onCloseTerminal: (scope: TerminalScope, terminalId: string) => void;
  onUpdateDraft: (
    scope: TerminalScope,
    terminalId: string,
    draft: string,
  ) => void;
  onRunCommand: (scope: TerminalScope, terminalId: string) => void;
};

export function WorkspaceTerminalPane({
  dock,
  socketReady,
  activeScope,
  scopeTabs,
  activeTabId,
  activeTab,
  terminalSize,
  paneRef,
  outputRef,
  commandInputRef,
  onResizeStart,
  onCreateTerminal,
  onHideTerminal,
  onSetActiveScope,
  onSetActiveTab,
  onCloseTerminal,
  onUpdateDraft,
  onRunCommand,
}: WorkspaceTerminalPaneProps) {
  const activeBuffer = activeTab?.buffer ?? "";
  const { history: terminalHistory, prompt: terminalPrompt } =
    splitTerminalBuffer(activeBuffer);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeTab) {
      return;
    }

    onRunCommand(activeScope, activeTab.id);
  };

  return (
    <div
      ref={paneRef}
      className={`relative flex min-h-0 min-w-0 flex-col overflow-hidden border-Cborder bg-[#041015] ${
        dock === "bottom" ? "border-t" : "border-l"
      }`}
      style={{
        [dock === "bottom" ? "height" : "width"]: `${terminalSize}%`,
      }}
    >
      <button
        type="button"
        aria-label="Resize terminal"
        onMouseDown={onResizeStart}
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

      <div
        className={`border-b border-Cborder px-4 py-3 ${
          dock === "right" ? "space-y-3" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-white/75">
            <TerminalSquare className="h-4 w-4 shrink-0 text-accent" />
            <span className="truncate text-sm text-white/85">terminal</span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onCreateTerminal}
              className="rounded-lg border border-Cborder/70 bg-panel/40 p-2 text-white/55 transition hover:border-accent/40 hover:text-white"
              aria-label="Create terminal"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={onHideTerminal}
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
        </div>

        <div
          className={`flex gap-3 ${
            dock === "right" ? "mt-1 flex-col items-stretch" : "items-center"
          }`}
        >
          <div
            className={`flex rounded-full border border-Cborder/80 bg-panel/50 p-1 text-sm ${
              dock === "right" ? "w-full" : ""
            }`}
          >
            {(["private", "shared"] as TerminalScope[]).map((scope) => {
              const active = activeScope === scope;
              return (
                <button
                  key={scope}
                  type="button"
                  onClick={() => onSetActiveScope(scope)}
                  className={`rounded-full px-3 py-1.5 transition ${
                    dock === "right" ? "flex-1" : ""
                  } ${
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

          <div
            className={`min-w-0 flex-1 ${
              dock === "right" ? "overflow-visible" : "overflow-x-auto"
            }`}
          >
            <div
              className={`flex items-center gap-2 ${
                dock === "right" ? "flex-wrap" : "min-w-max"
              }`}
            >
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
                      onClick={() => onSetActiveTab(activeScope, tab.id)}
                      className="px-2.5 py-1.5 text-sm"
                    >
                      {index + 1}
                    </button>
                    <button
                      type="button"
                      aria-label={`Close terminal ${index + 1}`}
                      onClick={() => onCloseTerminal(activeScope, tab.id)}
                      className="px-1.5 text-white/30 transition hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {activeTab ? (
        <div
          ref={outputRef}
          onClick={() => commandInputRef.current?.focus()}
          className="min-h-0 flex-1 overflow-y-auto bg-[#02090c] px-4 py-4 font-fira text-[13px] leading-6 text-white/78"
        >
          <div className="flex min-h-full flex-col justify-end">
            {activeTab.buffer ? (
              <pre className="whitespace-pre-wrap break-words">{terminalHistory}</pre>
            ) : null}
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-0 pt-1 font-fira text-sm"
            >
              {terminalPrompt ? (
                <span className="whitespace-pre text-accent/90">
                  {terminalPrompt}
                </span>
              ) : null}
              <input
                ref={commandInputRef}
                value={activeTab.commandDraft}
                onChange={(event) =>
                  onUpdateDraft(activeScope, activeTab.id, event.target.value)
                }
                autoComplete="off"
                spellCheck={false}
                placeholder=""
                className="min-w-0 flex-1 bg-transparent text-white outline-none"
              />
            </form>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-start px-4 py-4">
          <div className="max-w-full">
            <p className="text-base text-white">No {activeScope} terminals yet.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <button
                type="button"
                onClick={onCreateTerminal}
                className="rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-white transition hover:bg-accent/20"
              >
                New terminal
              </button>
              <span className="text-white/40">
                Create one to start running commands.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function WorkspaceTerminalRevealButton({
  dock,
  onClick,
}: {
  dock: DockPosition;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute z-20 rounded-full border border-Cborder bg-panel/95 p-2 text-white/55 shadow-[0_10px_28px_rgba(0,0,0,0.35)] transition hover:text-white ${
        dock === "bottom"
          ? "bottom-4 right-4"
          : "right-4 top-1/2 -translate-y-1/2"
      }`}
      aria-label="Show terminal"
    >
      {dock === "bottom" ? (
        <ChevronDown className="h-4 w-4 rotate-180" />
      ) : (
        <ChevronRight className="h-4 w-4 rotate-180" />
      )}
    </button>
  );
}
