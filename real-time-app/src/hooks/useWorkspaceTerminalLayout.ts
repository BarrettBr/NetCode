import { useEffect, useRef, useState } from "react";
import type { EditorSettings } from "@/lib/editorSettings";
import type { TerminalScope, TerminalTab } from "@/lib/workspaceTerminal";

export type DockPosition = EditorSettings["terminalDock"];

type ResizeState = {
  dock: DockPosition;
} | null;

const MIN_TERMINAL_PX = 180;
const MAX_TERMINAL_PERCENT = 60;
const DEFAULT_TERMINAL_SIZE: Record<DockPosition, number> = {
  bottom: 34,
  right: 42,
};

function clampTerminalPercent(value: number, availablePx: number): number {
  if (!Number.isFinite(value) || availablePx <= 0) {
    return DEFAULT_TERMINAL_SIZE.bottom;
  }

  const minPercent = Math.min(
    MAX_TERMINAL_PERCENT,
    (MIN_TERMINAL_PX / availablePx) * 100,
  );
  return Math.min(MAX_TERMINAL_PERCENT, Math.max(minPercent, value));
}

type UseWorkspaceTerminalLayoutArgs = {
  dock: DockPosition;
  activeScope: TerminalScope;
  activeTab: TerminalTab | null;
  resizeTerminal: (
    scope: TerminalScope,
    terminalId: string,
    cols: number,
    rows: number,
  ) => void;
};

export function useWorkspaceTerminalLayout({
  dock,
  activeScope,
  activeTab,
  resizeTerminal,
}: UseWorkspaceTerminalLayoutArgs) {
  const [isTerminalVisible, setIsTerminalVisible] = useState(true);
  const [terminalSize, setTerminalSize] =
    useState<Record<DockPosition, number>>(DEFAULT_TERMINAL_SIZE);
  const [resizeState, setResizeState] = useState<ResizeState>(null);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const terminalPaneRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!activeTab) {
      return;
    }

    outputRef.current?.scrollTo({
      top: outputRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [activeTab]);

  useEffect(() => {
    if (!activeTab || !isTerminalVisible) {
      return;
    }

    commandInputRef.current?.focus();
  }, [activeScope, activeTab, isTerminalVisible]);

  useEffect(() => {
    if (!activeTab || !isTerminalVisible || resizeState) {
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
    resizeState,
    resizeTerminal,
    terminalSize,
  ]);

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

  return {
    isTerminalVisible,
    setIsTerminalVisible,
    terminalSize,
    resizeState,
    setResizeState,
    surfaceRef,
    terminalPaneRef,
    outputRef,
    commandInputRef,
  };
}
