import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import FileExplorer from "@/components/FileExplorer";

export default function Sidebar() {
  return (
    <div className="mt-2 flex h-full min-h-0 w-full flex-col border-t border-t-Cborder/80 pt-4">
      <WorkspaceSwitcher />
      <div className="mt-4 min-h-0 flex-1 pr-1">
        <FileExplorer />
      </div>
    </div>
  );
}
