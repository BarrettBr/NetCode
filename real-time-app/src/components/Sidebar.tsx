import settingsIcon from "@/assets/settings.svg";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import FileExplorer from "@/components/FileExplorer";

type Props = {
  currentSite: string;
  setSite: (site: string) => void;
};

export default function Sidebar({ currentSite, setSite }: Props) {
  const settingsActive = currentSite === "settings";

  return (
    <div className="mt-2 flex h-full min-h-0 w-full flex-col border-t border-t-Cborder/80 pt-4">
      <WorkspaceSwitcher />
      <div className="mt-4 min-h-0 flex-1 pr-1">
        <FileExplorer />
      </div>
      <div className="mt-4 border-t border-Cborder/70 pt-4">
        <button
          type="button"
          onClick={() => setSite("settings")}
          className={`flex h-11 w-full items-center rounded-xl px-4 transition ${
            settingsActive
              ? "border border-Cborder bg-light-panel"
              : "border border-transparent hover:bg-light-panel/60"
          }`}
        >
          <img src={settingsIcon} className="mr-3 h-4 w-4" />
          <p
            className={`font-semibold ${
              settingsActive ? "text-tab-active" : "text-white/75"
            }`}
          >
            Settings
          </p>
        </button>
      </div>
    </div>
  );
}
