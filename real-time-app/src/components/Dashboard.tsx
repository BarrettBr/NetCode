import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, StickyNote, Trash2 } from "lucide-react";
import RepoCard from "@/components/RepoCard";
import FileCard from "@/components/FileCard";
import ProjectActivityChart from "./ProjectActivityChart";
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

type NoteItem = {
  id: string;
  text: string;
  createdAt: string;
};

const NOTES_STORAGE_KEY = "netcode-workspace-notes";

const repositoryCards = [
  {
    name: "netcode",
    descrip:
      "Collaborative editor with OT-based sync, multi-device editing, and browser-side virtualized code surfaces.",
    language: "Go",
    date: "Updated Mar 10",
  },
  {
    name: "monkechat",
    descrip:
      "Realtime chat client experiments around lightweight presence and mobile-first interaction flows.",
    language: "TypeScript",
    date: "Updated Mar 07",
  },
  {
    name: "dev-notes",
    descrip:
      "Internal snippets, review templates, and design references for ongoing workspace work.",
    language: "Markdown",
    date: "Updated Mar 03",
  },
];

const favoriteFiles = [
  {
    repo: "netcode",
    fileName: "room_manager.go",
    date: "today at 12:03 AM",
    meta: "backend",
  },
  {
    repo: "real-time-app/src/hooks",
    fileName: "useRopes.tsx",
    date: "today at 11:51 PM",
    meta: "sync",
  },
  {
    repo: "real-time-app/src/components",
    fileName: "textbox.tsx",
    date: "today at 11:46 PM",
    meta: "editor",
  },
];

const recentFiles = [
  {
    repo: "real-time-app/src/pages",
    fileName: "Workspace.tsx",
    date: "today at 12:07 AM",
    meta: "ui",
  },
  {
    repo: "real-time-app/src/components",
    fileName: "FileExplorer.tsx",
    date: "today at 12:05 AM",
    meta: "nav",
  },
  {
    repo: "real-time-app/src/components",
    fileName: "Dashboard.tsx",
    date: "today at 12:01 AM",
    meta: "dash",
  },
  {
    repo: "real-time-app/tests",
    fileName: "collab-sync.spec.ts",
    date: "yesterday at 11:59 PM",
    meta: "test",
  },
];

export default function Dashboard({ user }: Props) {
  const [noteInput, setNoteInput] = useState("");
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const notesLoadedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const saved = window.localStorage.getItem(NOTES_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as NoteItem[];
        setNotes(parsed);
        notesLoadedRef.current = true;
        return;
      } catch {
        // Ignore malformed persisted notes and fall back to defaults.
      }
    }

    setNotes([
      {
        id: "seed-note-1",
        text: "Follow up on the workspace route polish after the next sync refactor lands.",
        createdAt: new Date().toISOString(),
      },
    ]);
    notesLoadedRef.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !notesLoadedRef.current) {
      return;
    }
    window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  const noteCountLabel = useMemo(
    () => `${notes.length} note${notes.length === 1 ? "" : "s"}`,
    [notes]
  );

  const addNote = () => {
    const trimmed = noteInput.trim();
    if (!trimmed) {
      return;
    }

    setNotes((prev) => [
      {
        id: `${Date.now()}`,
        text: trimmed,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setNoteInput("");
  };

  const removeNote = (id: string) => {
    setNotes((prev) => prev.filter((note) => note.id !== id));
  };

  return (
    <div className="grid min-h-full grid-cols-1 gap-6 p-6 font-fira xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
        <section className="px-4 py-2">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1>Welcome Back, {user}.</h1>
              <p className="mt-2 text-base text-white/55">
                Active repositories, quick file access, and workspace notes in one place.
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
              <CarouselPrevious className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-light-panel border border-Cborder" />
              <CarouselNext className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-light-panel border border-Cborder" />
            </Carousel>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="min-w-0 space-y-6">
            <section className="rounded-3xl border border-Cborder bg-panel/80 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xl text-white">Favorites</p>
                  <p className="text-sm text-white/45">Pinned files you keep revisiting.</p>
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

      <aside className="flex min-h-[24rem] flex-col rounded-3xl border border-Cborder bg-panel/90 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-accent" />
            <div>
              <p className="font-semibold text-white">Notes</p>
              <p className="text-xs text-white/45">{noteCountLabel}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Add note"
            onClick={addNote}
            className="rounded-md border border-Cborder bg-light-panel p-2 text-white/75 transition hover:bg-white/8 hover:text-white"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-2xl border border-Cborder bg-light-panel/70 p-3">
          <input
            type="text"
            value={noteInput}
            onChange={(event) => setNoteInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addNote();
              }
            }}
            placeholder="Add a note for this workspace..."
            className="w-full bg-transparent text-sm text-white/80 outline-none placeholder:text-white/30"
          />
        </div>

        <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1 custom-scroll">
          {notes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-Cborder px-4 py-6 text-sm text-white/40">
              No notes yet. Add one to keep track of pending edits.
            </div>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="rounded-2xl border border-Cborder bg-light-panel/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm leading-6 text-white/78">{note.text}</p>
                  <button
                    type="button"
                    aria-label="Delete note"
                    onClick={() => removeNote(note.id)}
                    className="rounded-md p-1 text-white/35 transition hover:bg-white/8 hover:text-white"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-white/28">
                  {new Date(note.createdAt).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
