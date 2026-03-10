import { GitBranch } from "lucide-react";
import SelectScrollable from "@/components/select-10";

export default function BranchSwapper() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-transparent bg-white/[0.03] px-3.5 py-3 transition hover:border-Cborder/70 hover:bg-white/[0.05]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-Cborder/55 text-tab-active">
        <GitBranch className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35">
          Branch
        </p>
        <div className="mt-1">
          <SelectScrollable />
        </div>
      </div>
    </div>
  );
}
