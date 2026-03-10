import branch from "@/assets/git-branch.svg";
import SelectScrollable from "@/components/select-10";

export default function BranchSwapper() {
  return (
    <div className="mt-2 flex h-10 flex-row items-center gap-2">
      <img src={branch} className="h-4 w-4" />
      <SelectScrollable />
    </div>
  );
}
