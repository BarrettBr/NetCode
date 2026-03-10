import Dashboard from "@/components/Dashboard";
import dashIcon from "@/assets/dashboard.svg";
import codeIcon from "@/assets/code-file.svg";
import WorkspaceCode from "@/pages/WorkspaceCode";
import Settings from "@/pages/Settings";
import Sidebar from "@/components/Sidebar";
import {
  DEFAULT_EDITOR_SETTINGS,
  type EditorSettings,
} from "@/lib/editorSettings";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  currentSite: string;
  setSite: (site: string) => void;
};

const MIN_SIDEBAR_WIDTH = 260;
const MAX_SIDEBAR_WIDTH = 420;
const DEFAULT_SIDEBAR_WIDTH = 292;

export default function Workspace({ currentSite, setSite }: Props) {
  const [editorSettings, setEditorSettings] =
    useState<EditorSettings>(DEFAULT_EDITOR_SETTINGS);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const buttonClass = (active: boolean) =>
    `flex h-11 w-full select-none items-center rounded-xl px-4 transition ${
      active ? "bg-light-panel border border-Cborder" : "border border-transparent hover:bg-light-panel/60"
    }`;

  const textClass = (active: boolean) =>
    `font-semibold ${active ? "text-tab-active" : "text-white/75"}`;

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const handlePointerMove = (event: MouseEvent) => {
      setSidebarWidth(
        Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, event.clientX)),
      );
    };

    const handlePointerUp = () => setIsResizing(false);

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, [isResizing]);

  return (
    <div className="flex h-[calc(100vh-70px)] flex-row overflow-hidden">
      {/* Sidebar */}
      {!isSidebarHidden && (
        <div className="group/sidebar hidden h-full shrink-0 md:flex">
          <div
            className="flex h-full shrink-0 flex-col gap-4 bg-panel/40 px-4 pt-6"
            style={{ width: `${sidebarWidth}px` }}
          >
            <button
              type="button"
              className={buttonClass(currentSite === "dash")}
              onClick={() => setSite("dash")}
            >
              <img src={dashIcon} className="mr-3 h-4 w-4" />
              <p className={textClass(currentSite === "dash")}>Dashboard</p>
            </button>
            <button
              type="button"
              className={buttonClass(currentSite === "code")}
              onClick={() => setSite("code")}
            >
              <img src={codeIcon} className="mr-3 h-4 w-4" />
              <p className={textClass(currentSite === "code")}>Code</p>
            </button>
            <Sidebar currentSite={currentSite} setSite={setSite} />
          </div>

          <div className="relative hidden h-full w-6 shrink-0 md:block">
            <div
              className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition ${
                isResizing ? "bg-accent" : "bg-Cborder"
              }`}
            />
            <button
              type="button"
              aria-label="Hide sidebar"
              onClick={() => setIsSidebarHidden(true)}
              className="absolute left-1/2 top-6 z-20 -translate-x-1/2 rounded-full border border-Cborder bg-panel/95 p-1 text-white/45 opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.32)] transition group-hover/sidebar:opacity-100 hover:text-white"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Resize sidebar"
              onMouseDown={() => setIsResizing(true)}
              className="absolute bottom-0 left-1/2 top-16 z-10 flex w-6 -translate-x-1/2 items-center justify-center"
            >
              <span className="flex h-6 w-6 items-center justify-center opacity-0 transition group-hover/sidebar:opacity-100">
                <GripVertical className="h-4 w-4 rounded-full bg-panel/95 p-0.5 text-white/35 shadow-[0_8px_24px_rgba(0,0,0,0.25)]" />
              </span>
            </button>
          </div>
        </div>
      )}

      {isSidebarHidden && (
        <div className="relative hidden h-full w-6 shrink-0 md:block">
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-Cborder" />
          <button
            type="button"
            aria-label="Show sidebar"
            onClick={() => setIsSidebarHidden(false)}
            className="absolute left-1/2 top-6 z-10 -translate-x-1/2 rounded-full border border-Cborder bg-panel/95 p-1 text-white/55 shadow-[0_8px_24px_rgba(0,0,0,0.32)] transition hover:bg-light-panel hover:text-white"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="relative min-h-0 min-w-0 flex-1 overflow-y-auto bg-bg">
        {currentSite === "dash" && <Dashboard user="Barrett" />}
        {currentSite === "code" && (
          <WorkspaceCode editorSettings={editorSettings} />
        )}
        {currentSite === "settings" && (
          <Settings
            editorSettings={editorSettings}
            setEditorSettings={setEditorSettings}
          />
        )}
      </div>
    </div>
  );
}
