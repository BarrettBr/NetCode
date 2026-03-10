import { Link } from "react-router-dom";
import { ArrowRight, Play } from "lucide-react";

const capabilities = [
  {
    title: "Shared editing",
    description:
      "Work in the same file from multiple devices and keep the document synchronized as you type.",
  },
  {
    title: "Inline execution",
    description:
      "Run code beside the editor so output stays attached to the file you are working on.",
  },
  {
    title: "In-context review",
    description:
      "Request review inside the workspace instead of switching between separate tools.",
  },
];

const flow = [
  "Start a room",
  "Join from another device",
  "Write, run, review",
];

export default function Landing() {
  return (
    <div className="relative flex flex-1 overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10rem] top-[-3rem] h-[20rem] w-[20rem] rounded-full bg-[#0e4c5b]/24 blur-3xl md:h-[28rem] md:w-[28rem]" />
        <div className="absolute right-[-8rem] top-[18rem] h-[18rem] w-[18rem] rounded-full bg-[#0f706b]/16 blur-3xl md:h-[24rem] md:w-[24rem]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#2e7c78] to-transparent opacity-70" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1120px] flex-col gap-18 px-6 pb-20 pt-14 sm:px-10 md:pt-20">
        <section className="max-w-4xl">
          <p className="text-sm uppercase tracking-[0.28em] text-accent/75">
            Welcome to NetCode
          </p>

          <h1 className="mt-6 max-w-[11ch] text-[clamp(3.6rem,9vw,7.2rem)] leading-[0.9] tracking-[-0.06em] text-white">
            Collaborative coding, kept simple.
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-9 text-white/62 sm:text-xl">
            NetCode gives you a shared editor, execution, and review in one
            browser workspace. Open a room, invite another device, and keep the
            session together.
          </p>

          <div className="mt-10 flex w-full max-w-xl flex-col gap-3 sm:flex-row">
            <Link
              to="/"
              className="inline-flex min-h-13 select-none items-center justify-center gap-2 rounded-2xl bg-run px-6 py-4 text-base font-semibold text-white transition hover:bg-run-hover"
            >
              Open Editor
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/workspace"
              className="inline-flex min-h-13 select-none items-center justify-center gap-2 rounded-2xl border border-Cborder/80 bg-transparent px-6 py-4 text-base text-white/82 transition hover:bg-white/6 hover:text-white"
            >
              Explore Workspace
              <Play className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="max-w-5xl border-t border-Cborder/70 pt-10">
          <div className="max-w-2xl">
            <p className="text-sm uppercase tracking-[0.28em] text-accent/75">
              This is what we do
            </p>
            <h2 className="mt-4 text-3xl leading-tight tracking-[-0.04em] text-white md:text-4xl">
              Three pieces, one workspace.
            </h2>
          </div>

          <div className="mt-10 divide-y divide-Cborder/60 border-y border-Cborder/60">
            {capabilities.map((item) => (
              <div
                key={item.title}
                className="grid gap-4 py-7 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:gap-8"
              >
                <h3 className="text-2xl leading-8 text-white">{item.title}</h3>
                <p className="max-w-2xl text-base leading-8 text-white/58 sm:text-lg">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-5xl border-t border-Cborder/70 pt-10">
          <p className="text-sm uppercase tracking-[0.28em] text-accent/75">
            Flow
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-3 md:gap-0 md:divide-x md:divide-Cborder/60">
            {flow.map((item, index) => (
              <div key={item} className="md:px-6 first:md:pl-0 last:md:pr-0">
                <p className="text-xs uppercase tracking-[0.24em] text-white/35">
                  0{index + 1}
                </p>
                <p className="mt-4 text-2xl leading-8 text-white">{item}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
