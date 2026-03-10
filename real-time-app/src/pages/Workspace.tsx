import Dashboard from "@/components/Dashboard";
import dashIcon from "@/assets/dashboard.svg";
import codeIcon from "@/assets/code-file.svg";
import settingsIcon from "@/assets/settings.svg";
import Code from "@/pages/Code";
import Settings from "@/pages/Settings";
import Sidebar from "@/components/Sidebar";

type Props = {
  currentSite: string;
  setSite: (site: string) => void;
};

export default function Workspace({ currentSite, setSite }: Props) {
  const buttonClass = (active: boolean) =>
    `flex h-11 w-full select-none items-center rounded-xl px-4 transition ${
      active ? "bg-light-panel border border-Cborder" : "border border-transparent hover:bg-light-panel/60"
    }`;

  const textClass = (active: boolean) =>
    `font-semibold ${active ? "text-tab-active" : "text-white/75"}`;

  return (
    <div className="flex h-[calc(100vh-70px)] flex-row overflow-hidden">
      {/* Sidebar */}
      <div className="hidden h-full w-[260px] shrink-0 flex-col gap-4 border-r-2 border-r-Cborder bg-panel/40 px-4 pt-6 md:flex">
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
        <button
          type="button"
          className={buttonClass(currentSite === "settings")}
          onClick={() => setSite("settings")}
        >
          <img src={settingsIcon} className="mr-3 h-4 w-4" />
          <p className={textClass(currentSite === "settings")}>Settings</p>
        </button>
        <Sidebar />
      </div>

      {/* Expandable Area */}
      {/*
      <div className="w-2 relative cursor-col-resize">
        <div className="absolute inset-y-0 left-1/2 w-2 -translate-x-1/2" />
        <div className="relative w-1 h-full bg-Cborder" />
      </div>
      */}

      {/* Main Content */}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-bg">
        {currentSite === "dash" && <Dashboard user="Barrett" />}
        {currentSite === "code" && <Code />}
        {currentSite === "settings" && <Settings />}
      </div>
    </div>
  );
}
