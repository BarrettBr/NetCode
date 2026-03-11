import folder from "@/assets/folder.svg";

type Props = {
  repo: string;
  fileName: string;
  date: string;
  meta?: string;
};

export default function FileCard({ repo, fileName, date, meta }: Props) {
  return (
    <button
      type="button"
      className="group flex w-full cursor-pointer select-none items-start gap-3 rounded-xl border border-Cborder bg-panel/70 px-4 py-3 text-left transition hover:border-accent/40 hover:bg-light-panel/85"
    >
      <div className="mt-0.5 rounded-lg border border-Cborder bg-light-panel p-2">
        <img src={folder} className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-base font-semibold text-white">
            {fileName}
          </p>
          {meta && (
            <span className="shrink-0 rounded-full bg-white/6 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-accent">
              {meta}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-sm text-white/55">{repo}</p>
        <p className="mt-2 text-xs text-white/35">Last opened {date}</p>
      </div>
    </button>
  );
}
