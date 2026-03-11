type Props = {
  name: string;
  descrip: string;
  language: string;
  date: string;
};

export default function RepoCard({ name, descrip, language, date }: Props) {
  return (
    <button
      type="button"
      className="flex h-full min-h-[16rem] w-full cursor-pointer flex-col rounded-2xl border border-Cborder bg-light-panel px-5 py-4 text-left transition hover:border-accent/40 hover:bg-[#112630]"
    >
      <p className="text-xl font-semibold text-white">{name}</p>
      <p className="mt-2 line-clamp-5 text-sm text-white/60">{descrip}</p>
      <div className="mt-auto mb-3 w-fit rounded-xl bg-white/5 px-4 py-1 text-sm text-accent">
        {language}
      </div>
      <p className="text-sm text-white/45">{date}</p>
    </button>
  );
}
