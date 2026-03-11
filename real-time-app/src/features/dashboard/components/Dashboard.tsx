import RepoCard from "./RepoCard";
import FileCard from "./FileCard";
import DashboardNotes from "./DashboardNotes";
import ProjectActivityChart from "./ProjectActivityChart";
import {
  favoriteFiles,
  recentFiles,
  repositoryCards,
} from "../data/dashboardData";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

type Props = {
  user: string;
};
export default function Dashboard({ user }: Props) {
  return (
    <div className="grid min-h-full grid-cols-1 gap-6 p-6 font-fira xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
        <section className="px-4 py-2">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1>Welcome Back, {user}.</h1>
              <p className="mt-2 text-base text-white/55">
                Active repositories, quick file access, and workspace notes in
                one place.
              </p>
            </div>
            <div className="rounded-2xl bg-light-panel/80 px-4 py-3 text-sm text-white/60">
              3 repositories active this week
            </div>
          </div>

          <div className="relative px-2">
            <Carousel
              className="w-full px-8 md:px-12"
              opts={{
                align: "start",
                loop: true,
              }}
            >
              <CarouselContent className="-ml-4">
                {repositoryCards.map((repo) => (
                  <CarouselItem
                    key={repo.name}
                    className="pl-4 md:basis-1/2 xl:basis-1/3"
                  >
                    <RepoCard {...repo} />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="absolute left-0 top-1/2 z-10 -translate-y-1/2 border border-Cborder bg-light-panel" />
              <CarouselNext className="absolute right-0 top-1/2 z-10 -translate-y-1/2 border border-Cborder bg-light-panel" />
            </Carousel>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="min-w-0 space-y-6">
            <section className="rounded-3xl border border-Cborder bg-panel/80 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xl text-white">Favorites</p>
                  <p className="text-sm text-white/45">
                    Pinned files you keep revisiting.
                  </p>
                </div>
                <span className="rounded-full bg-white/6 px-3 py-1 text-xs uppercase tracking-[0.18em] text-accent">
                  {favoriteFiles.length}
                </span>
              </div>
              <div className="space-y-3">
                {favoriteFiles.map((file) => (
                  <FileCard key={`${file.repo}-${file.fileName}`} {...file} />
                ))}
              </div>
            </section>

            <ProjectActivityChart />
          </div>

          <section className="min-w-0 rounded-3xl border border-Cborder bg-panel/80 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xl text-white">Recent Files</p>
                <p className="text-sm text-white/45">
                  Continue where the last editing session stopped.
                </p>
              </div>
              <span className="rounded-full bg-white/6 px-3 py-1 text-xs uppercase tracking-[0.18em] text-accent">
                {recentFiles.length}
              </span>
            </div>
            <div className="space-y-3">
              {recentFiles.map((file) => (
                <FileCard key={`${file.repo}-${file.fileName}`} {...file} />
              ))}
            </div>
          </section>
        </div>
      </div>

      <DashboardNotes />
    </div>
  );
}
