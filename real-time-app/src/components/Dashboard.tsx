import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  GripVertical,
  Plus,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import RepoCard from "@/components/RepoCard";
import FileCard from "@/components/FileCard";
import ProjectActivityChart from "./ProjectActivityChart";
import { cn } from "@/lib/utils";
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

type DashboardNote = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  folderId: string | null;
};

type NoteFolder = {
  id: string;
  name: string;
  createdAt: string;
  noteIds: string[];
  childFolderIds: string[];
  parentFolderId: string | null;
  isOpen: boolean;
};

type NotesStore = {
  notes: DashboardNote[];
  folders: NoteFolder[];
  rootOrder: string[];
  rootFolderOrder: string[];
};

type LegacyNoteItem = {
  id: string;
  text: string;
  createdAt: string;
};

type SortMode = "manual" | "newest" | "oldest";

type DragState =
  | {
      kind: "note";
      itemId: string;
      sourceFolderId: string | null;
    }
  | {
      kind: "folder";
      itemId: string;
      parentFolderId: string | null;
    };

type ComposerMode = "note" | "folder" | null;

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

const noteDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function createId(prefix: "note" | "folder") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function pluralize(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function getNoteTitle(text: string) {
  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine || "Untitled note";
}

function getNotePreview(text: string) {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > 72 ? `${collapsed.slice(0, 72)}...` : collapsed;
}

function formatNoteDate(createdAt: string) {
  return noteDateFormatter.format(new Date(createdAt));
}

function createDefaultNotesStore(): NotesStore {
  const seedNoteId = "seed-note-1";

  return {
    notes: [
      {
        id: seedNoteId,
        title: "Workspace route polish",
        description:
          "Follow up on the workspace route polish after the next sync refactor lands.",
        createdAt: new Date().toISOString(),
        folderId: null,
      },
    ],
    folders: [],
    rootOrder: [seedNoteId],
    rootFolderOrder: [],
  };
}

function isLegacyNotes(value: unknown): value is LegacyNoteItem[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.text === "string" &&
        typeof item.createdAt === "string",
    )
  );
}

function normalizeStoredNote(note: unknown): DashboardNote | null {
  if (!note || typeof note !== "object") {
    return null;
  }

  const candidate = note as Record<string, unknown>;
  if (typeof candidate.id !== "string" || typeof candidate.createdAt !== "string") {
    return null;
  }

  const folderId = typeof candidate.folderId === "string" ? candidate.folderId : null;

  if (typeof candidate.title === "string") {
    return {
      id: candidate.id,
      title: candidate.title.trim() || "Untitled note",
      description:
        typeof candidate.description === "string" ? candidate.description : "",
      createdAt: candidate.createdAt,
      folderId,
    };
  }

  if (typeof candidate.text === "string") {
    return {
      id: candidate.id,
      title: getNoteTitle(candidate.text),
      description: candidate.text,
      createdAt: candidate.createdAt,
      folderId,
    };
  }

  return null;
}

function isNotesStore(value: unknown): value is Partial<NotesStore> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    Array.isArray(candidate.notes) &&
    Array.isArray(candidate.folders) &&
    Array.isArray(candidate.rootOrder)
  );
}

function normalizeNotesStore(store: Partial<NotesStore>): NotesStore {
  const notes = (store.notes ?? [])
    .map((note) => normalizeStoredNote(note))
    .filter((note): note is DashboardNote => Boolean(note));
  const noteIds = new Set(notes.map((note) => note.id));

  const rawFolders = (store.folders ?? [])
    .filter(
      (folder) =>
        Boolean(folder) &&
        typeof folder === "object" &&
        typeof (folder as Record<string, unknown>).id === "string" &&
        typeof (folder as Record<string, unknown>).name === "string" &&
        typeof (folder as Record<string, unknown>).createdAt === "string" &&
        Array.isArray((folder as Record<string, unknown>).noteIds),
    )
    .map((folder) => ({
      id: folder.id as string,
      name: folder.name as string,
      createdAt: folder.createdAt as string,
      noteIds: (folder.noteIds as unknown[]).filter(
        (noteId): noteId is string => typeof noteId === "string",
      ),
      childFolderIds: Array.isArray(folder.childFolderIds)
        ? folder.childFolderIds.filter(
            (folderId): folderId is string => typeof folderId === "string",
          )
        : [],
      parentFolderId:
        typeof folder.parentFolderId === "string" ? folder.parentFolderId : null,
      isOpen: folder.isOpen !== false,
    }));

  const folderIds = new Set(rawFolders.map((folder) => folder.id));
  const normalizedNotes = notes.map((note) => ({
    ...note,
    folderId: note.folderId && folderIds.has(note.folderId) ? note.folderId : null,
  }));

  const foldersWithParents = rawFolders.map((folder) => ({
    ...folder,
    parentFolderId:
      folder.parentFolderId && folderIds.has(folder.parentFolderId)
        ? folder.parentFolderId
        : null,
    childFolderIds: folder.childFolderIds.filter(
      (childFolderId) => childFolderId !== folder.id && folderIds.has(childFolderId),
    ),
    noteIds: folder.noteIds.filter((noteId) => noteIds.has(noteId)),
  }));

  const folderNoteLookup = new Set(
    foldersWithParents.flatMap((folder) => folder.noteIds),
  );
  const foldersWithNotes = foldersWithParents.map((folder) => {
    const missingNotes = normalizedNotes
      .filter(
        (note) =>
          note.folderId === folder.id && !folderNoteLookup.has(note.id),
      )
      .map((note) => note.id);

    return {
      ...folder,
      noteIds: [...folder.noteIds, ...missingNotes],
    };
  });

  const folders = foldersWithNotes.map((folder) => {
    const missingChildren = foldersWithNotes
      .filter(
        (childFolder) =>
          childFolder.parentFolderId === folder.id &&
          !folder.childFolderIds.includes(childFolder.id),
      )
      .map((childFolder) => childFolder.id);

    return {
      ...folder,
      childFolderIds: [...folder.childFolderIds, ...missingChildren],
    };
  });

  const assignedRootNoteIds = new Set(folders.flatMap((folder) => folder.noteIds));
  const rootOrderSource = Array.isArray(store.rootOrder) ? store.rootOrder : [];
  const rootOrder = rootOrderSource.filter(
    (noteId): noteId is string =>
      typeof noteId === "string" &&
      noteIds.has(noteId) &&
      !assignedRootNoteIds.has(noteId),
  );
  const missingRootNotes = normalizedNotes
    .filter((note) => note.folderId === null && !rootOrder.includes(note.id))
    .map((note) => note.id);

  const assignedChildFolderIds = new Set(
    folders.flatMap((folder) => folder.childFolderIds),
  );
  const rootFolderOrderSource = Array.isArray(store.rootFolderOrder)
    ? store.rootFolderOrder
    : [];
  const rootFolderOrder = rootFolderOrderSource.filter(
    (folderId): folderId is string =>
      typeof folderId === "string" &&
      folderIds.has(folderId) &&
      !assignedChildFolderIds.has(folderId) &&
      folders.some(
        (folder) => folder.id === folderId && folder.parentFolderId === null,
      ),
  );
  const missingRootFolders = folders
    .filter(
      (folder) =>
        folder.parentFolderId === null && !rootFolderOrder.includes(folder.id),
    )
    .map((folder) => folder.id);

  return {
    notes: normalizedNotes,
    folders,
    rootOrder: [...rootOrder, ...missingRootNotes],
    rootFolderOrder: [...rootFolderOrder, ...missingRootFolders],
  };
}

function migrateStoredNotes(raw: unknown): NotesStore {
  if (isLegacyNotes(raw)) {
    return {
      notes: raw.map((note) => ({
        id: note.id,
        title: getNoteTitle(note.text),
        description: note.text,
        createdAt: note.createdAt,
        folderId: null,
      })),
      folders: [],
      rootOrder: raw.map((note) => note.id),
      rootFolderOrder: [],
    };
  }

  if (isNotesStore(raw)) {
    return normalizeNotesStore(raw);
  }

  return createDefaultNotesStore();
}

function insertAt(items: string[], index: number, value: string) {
  const next = items.filter((item) => item !== value);
  const safeIndex = Math.max(0, Math.min(index, next.length));
  next.splice(safeIndex, 0, value);
  return next;
}

function sortByCreatedAt<T extends { createdAt: string }>(
  items: T[],
  mode: Exclude<SortMode, "manual">,
) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();
    return mode === "newest" ? rightTime - leftTime : leftTime - rightTime;
  });
}

function collectDescendantFolderIds(
  folders: NoteFolder[],
  folderId: string,
  bucket = new Set<string>(),
) {
  const folder = folders.find((item) => item.id === folderId);
  if (!folder) {
    return bucket;
  }

  folder.childFolderIds.forEach((childFolderId) => {
    if (bucket.has(childFolderId)) {
      return;
    }

    bucket.add(childFolderId);
    collectDescendantFolderIds(folders, childFolderId, bucket);
  });

  return bucket;
}

function moveNote(
  store: NotesStore,
  dragState: Extract<DragState, { kind: "note" }>,
  destinationFolderId: string | null,
  destinationIndex: number,
): NotesStore {
  const notes = store.notes.map((note) =>
    note.id === dragState.itemId
      ? { ...note, folderId: destinationFolderId }
      : note,
  );
  const rootOrder = insertAt(
    store.rootOrder.filter((noteId) => noteId !== dragState.itemId),
    destinationFolderId === null ? destinationIndex : store.rootOrder.length,
    dragState.itemId,
  );
  const folders = store.folders.map((folder) => {
    let noteIds = folder.noteIds.filter((noteId) => noteId !== dragState.itemId);

    if (folder.id === destinationFolderId) {
      noteIds = insertAt(noteIds, destinationIndex, dragState.itemId);
    }

    return { ...folder, noteIds };
  });

  return {
    ...store,
    notes,
    folders,
    rootOrder:
      destinationFolderId === null
        ? rootOrder
        : rootOrder.filter((noteId) => noteId !== dragState.itemId),
  };
}

function moveFolder(
  store: NotesStore,
  dragState: Extract<DragState, { kind: "folder" }>,
  destinationParentFolderId: string | null,
  destinationIndex: number,
): NotesStore {
  const descendantIds = collectDescendantFolderIds(store.folders, dragState.itemId);

  if (
    destinationParentFolderId === dragState.itemId ||
    (destinationParentFolderId !== null &&
      descendantIds.has(destinationParentFolderId))
  ) {
    return store;
  }

  const rootFolderOrder = insertAt(
    store.rootFolderOrder.filter((folderId) => folderId !== dragState.itemId),
    destinationParentFolderId === null
      ? destinationIndex
      : store.rootFolderOrder.length,
    dragState.itemId,
  );

  const folders = store.folders.map((folder) => {
    let childFolderIds = folder.childFolderIds.filter(
      (folderId) => folderId !== dragState.itemId,
    );

    if (folder.id === destinationParentFolderId) {
      childFolderIds = insertAt(childFolderIds, destinationIndex, dragState.itemId);
    }

    if (folder.id === dragState.itemId) {
      return {
        ...folder,
        parentFolderId: destinationParentFolderId,
        childFolderIds,
      };
    }

    return { ...folder, childFolderIds };
  });

  return {
    ...store,
    folders,
    rootFolderOrder:
      destinationParentFolderId === null
        ? rootFolderOrder
        : rootFolderOrder.filter((folderId) => folderId !== dragState.itemId),
  };
}

export default function Dashboard({ user }: Props) {
  const [notesStore, setNotesStore] = useState<NotesStore>(
    createDefaultNotesStore,
  );
  const [sortMode, setSortMode] = useState<SortMode>("manual");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [composerMode, setComposerMode] = useState<ComposerMode>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState({ title: "", description: "" });
  const [folderDraft, setFolderDraft] = useState("");
  const notesLoadedRef = useRef(false);

  const notes = notesStore.notes;
  const folders = notesStore.folders;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const saved = window.localStorage.getItem(NOTES_STORAGE_KEY);
    if (saved) {
      try {
        setNotesStore(migrateStoredNotes(JSON.parse(saved)));
        notesLoadedRef.current = true;
        return;
      } catch {
        // Ignore malformed persisted notes and fall back to defaults.
      }
    }

    setNotesStore(createDefaultNotesStore());
    notesLoadedRef.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !notesLoadedRef.current) {
      return;
    }

    window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notesStore));
  }, [notesStore]);

  const closeComposer = () => {
    setComposerMode(null);
    setEditingNoteId(null);
    setNoteDraft({ title: "", description: "" });
    setFolderDraft("");
  };

  useEffect(() => {
    if (!composerMode || typeof window === "undefined") {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeComposer();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [composerMode]);

  const noteMap = useMemo(
    () => new Map(notes.map((note) => [note.id, note])),
    [notes],
  );
  const folderMap = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder])),
    [folders],
  );
  const canDragItems = sortMode === "manual";

  const getFoldersForParent = (parentFolderId: string | null) => {
    if (sortMode === "manual") {
      const ids =
        parentFolderId === null
          ? notesStore.rootFolderOrder
          : folderMap.get(parentFolderId)?.childFolderIds ?? [];

      return ids
        .map((folderId) => folderMap.get(folderId))
        .filter((folder): folder is NoteFolder => Boolean(folder));
    }

    return sortByCreatedAt(
      folders.filter((folder) => folder.parentFolderId === parentFolderId),
      sortMode,
    );
  };

  const rootFolders = useMemo(
    () => getFoldersForParent(null),
    [folderMap, folders, notesStore.rootFolderOrder, sortMode],
  );

  const rootNotes = useMemo(() => {
    if (sortMode === "manual") {
      return notesStore.rootOrder
        .map((noteId) => noteMap.get(noteId))
        .filter((note): note is DashboardNote => Boolean(note));
    }

    return sortByCreatedAt(
      notes.filter((note) => note.folderId === null),
      sortMode,
    );
  }, [noteMap, notes, notesStore.rootOrder, sortMode]);

  const notesByFolder = useMemo(() => {
    const grouped = new Map<string, DashboardNote[]>();

    folders.forEach((folder) => {
      const folderNotes =
        sortMode === "manual"
          ? folder.noteIds
              .map((noteId) => noteMap.get(noteId))
              .filter((note): note is DashboardNote => Boolean(note))
          : sortByCreatedAt(
              notes.filter((note) => note.folderId === folder.id),
              sortMode,
            );

      grouped.set(folder.id, folderNotes);
    });

    return grouped;
  }, [folders, noteMap, notes, sortMode]);

  const noteCountText = pluralize(notes.length, "note");
  const folderCountText = folders.length > 0 ? pluralize(folders.length, "folder") : null;

  const openCreateNoteComposer = () => {
    setEditingNoteId(null);
    setNoteDraft({ title: "", description: "" });
    setComposerMode("note");
  };

  const openEditNoteComposer = (note: DashboardNote) => {
    setEditingNoteId(note.id);
    setNoteDraft({
      title: note.title,
      description: note.description,
    });
    setComposerMode("note");
  };

  const openFolderComposer = () => {
    setFolderDraft("");
    setComposerMode("folder");
  };

  const saveNote = () => {
    const trimmedTitle = noteDraft.title.trim();
    const trimmedDescription = noteDraft.description.trim();

    if (!trimmedTitle) {
      return;
    }

    if (editingNoteId) {
      setNotesStore((prev) => ({
        ...prev,
        notes: prev.notes.map((note) =>
          note.id === editingNoteId
            ? {
                ...note,
                title: trimmedTitle,
                description: trimmedDescription,
              }
            : note,
        ),
      }));
      closeComposer();
      return;
    }

    const nextNote: DashboardNote = {
      id: createId("note"),
      title: trimmedTitle,
      description: trimmedDescription,
      createdAt: new Date().toISOString(),
      folderId: null,
    };

    setNotesStore((prev) => ({
      ...prev,
      notes: [nextNote, ...prev.notes],
      rootOrder: [nextNote.id, ...prev.rootOrder],
    }));
    closeComposer();
  };

  const addFolder = () => {
    const trimmed = folderDraft.trim();
    const nextFolder: NoteFolder = {
      id: createId("folder"),
      name: trimmed || `Folder ${folders.length + 1}`,
      createdAt: new Date().toISOString(),
      noteIds: [],
      childFolderIds: [],
      parentFolderId: null,
      isOpen: true,
    };

    setNotesStore((prev) => ({
      ...prev,
      folders: [nextFolder, ...prev.folders],
      rootFolderOrder: [nextFolder.id, ...prev.rootFolderOrder],
    }));
    closeComposer();
  };

  const removeNote = (id: string) => {
    setNotesStore((prev) => ({
      ...prev,
      notes: prev.notes.filter((note) => note.id !== id),
      folders: prev.folders.map((folder) => ({
        ...folder,
        noteIds: folder.noteIds.filter((noteId) => noteId !== id),
      })),
      rootOrder: prev.rootOrder.filter((noteId) => noteId !== id),
    }));
  };

  const removeFolder = (folderId: string) => {
    setNotesStore((prev) => {
      const folder = prev.folders.find((item) => item.id === folderId);
      if (!folder) {
        return prev;
      }

      return {
        notes: prev.notes.map((note) =>
          note.folderId === folderId ? { ...note, folderId: null } : note,
        ),
        folders: prev.folders
          .filter((item) => item.id !== folderId)
          .map((item) => ({
            ...item,
            childFolderIds: item.childFolderIds.filter((childId) => childId !== folderId),
            parentFolderId: item.parentFolderId === folderId ? null : item.parentFolderId,
          })),
        rootOrder: [...folder.noteIds, ...prev.rootOrder],
        rootFolderOrder: [
          ...folder.childFolderIds,
          ...prev.rootFolderOrder.filter((itemId) => itemId !== folderId),
        ],
      };
    });
  };

  const toggleFolder = (folderId: string) => {
    setNotesStore((prev) => ({
      ...prev,
      folders: prev.folders.map((folder) =>
        folder.id === folderId
          ? { ...folder, isOpen: !folder.isOpen }
          : folder,
      ),
    }));
  };

  const clearDragState = () => {
    setDragState(null);
    setDropTarget(null);
  };

  const dropIntoRoot = () => {
    if (!dragState || !canDragItems) {
      return;
    }

    setNotesStore((prev) =>
      dragState.kind === "note"
        ? moveNote(prev, dragState, null, rootNotes.length)
        : moveFolder(prev, dragState, null, rootFolders.length),
    );
    clearDragState();
  };

  const dropIntoFolder = (folderId: string, noteCount: number, childFolderCount: number) => {
    if (!dragState || !canDragItems) {
      return;
    }

    setNotesStore((prev) =>
      dragState.kind === "note"
        ? moveNote(prev, dragState, folderId, noteCount)
        : moveFolder(prev, dragState, folderId, childFolderCount),
    );
    clearDragState();
  };

  const renderNoteRow = (
    note: DashboardNote,
    folderId: string | null,
    index: number,
  ) => (
    <div
      key={note.id}
      draggable={canDragItems}
      onDragStart={() =>
        canDragItems &&
        setDragState({ kind: "note", itemId: note.id, sourceFolderId: folderId })
      }
      onDragEnd={clearDragState}
      onDragOver={(event) => {
        if (
          !dragState ||
          !canDragItems ||
          dragState.kind !== "note" ||
          dragState.itemId === note.id
        ) {
          return;
        }

        event.preventDefault();
        setDropTarget(`note-${note.id}`);
      }}
      onDrop={(event) => {
        if (
          !dragState ||
          !canDragItems ||
          dragState.kind !== "note" ||
          dragState.itemId === note.id
        ) {
          return;
        }

        event.preventDefault();

        setNotesStore((prev) =>
          moveNote(prev, dragState, folderId, index),
        );
        clearDragState();
      }}
      className={cn(
        "group flex items-start gap-2 rounded-lg border px-2 py-2 transition",
        "border-transparent bg-transparent hover:border-Cborder/70 hover:bg-light-panel/75",
        canDragItems ? "cursor-grab active:cursor-grabbing" : "",
        dropTarget === `note-${note.id}`
          ? "border-accent/70 bg-light-panel/80 shadow-[0_0_0_1px_rgba(115,232,196,0.24)]"
          : "",
      )}
    >
      <div className="flex h-8 w-3 shrink-0 items-center justify-center text-white/18 transition group-hover:text-white/32">
        <GripVertical className="h-3.5 w-3.5" />
      </div>
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-Cborder/70 bg-light-panel/70 text-accent">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{note.title}</p>
            <p className="mt-0.5 truncate text-xs text-white/36">
              {getNotePreview(note.description || note.title)}
            </p>
          </div>
          <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
            <button
              type="button"
              aria-label="View note"
              onClick={() => openEditNoteComposer(note)}
              className="rounded-md p-1 text-white/24 transition hover:bg-white/8 hover:text-white"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Delete note"
              onClick={() => removeNote(note.id)}
              className="rounded-md p-1 text-white/22 transition hover:bg-white/8 hover:text-white"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/22">
          {formatNoteDate(note.createdAt)}
        </p>
      </div>
    </div>
  );

  const renderFolderNode = (folder: NoteFolder, depth = 0): React.ReactNode => {
    const childFolders = getFoldersForParent(folder.id);
    const folderNotes = notesByFolder.get(folder.id) ?? [];
    const isDropTarget = dropTarget === `folder-${folder.id}`;
    const canAcceptFolderDrop =
      !dragState ||
      dragState.kind !== "folder" ||
      (dragState.itemId !== folder.id &&
        !collectDescendantFolderIds(folders, dragState.itemId).has(folder.id));

    const activateFolderDropTarget = (event: React.DragEvent) => {
      if (!dragState || !canDragItems || !canAcceptFolderDrop) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setDropTarget(`folder-${folder.id}`);
    };

    const handleFolderDrop = (event: React.DragEvent) => {
      if (!dragState || !canDragItems || !canAcceptFolderDrop) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      dropIntoFolder(folder.id, folderNotes.length, childFolders.length);
    };

    return (
      <div key={folder.id} className="space-y-1">
        <div
          onDragOver={activateFolderDropTarget}
          onDrop={handleFolderDrop}
          className={cn(
            "rounded-xl border transition",
            isDropTarget
              ? "border-accent/70 bg-light-panel/65 shadow-[0_0_0_1px_rgba(115,232,196,0.24)]"
              : "border-transparent",
          )}
        >
          <div
            onDragOver={activateFolderDropTarget}
            onDrop={handleFolderDrop}
            className={cn(
              "group flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition",
              !isDropTarget && "hover:bg-light-panel/75",
            )}
          >
            <button
              type="button"
              draggable={canDragItems}
              onDragStart={() =>
                canDragItems &&
                setDragState({
                  kind: "folder",
                  itemId: folder.id,
                  parentFolderId: folder.parentFolderId,
                })
              }
              onDragEnd={clearDragState}
              className={cn(
                "flex h-8 w-3 shrink-0 items-center justify-center text-white/18 transition",
                canDragItems
                  ? "cursor-grab active:cursor-grabbing group-hover:text-white/32"
                  : "",
              )}
            >
            </button>
            <button
              type="button"
              onClick={() => toggleFolder(folder.id)}
              draggable={canDragItems}
              onDragStart={() =>
                canDragItems &&
                setDragState({
                  kind: "folder",
                  itemId: folder.id,
                  parentFolderId: folder.parentFolderId,
                })
              }
              onDragEnd={clearDragState}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 text-left",
                canDragItems ? "cursor-grab active:cursor-grabbing" : "",
              )}
            >
              <GripVertical className="h-3.5 w-3.5 shrink-0 text-white/18 transition group-hover:text-white/32" />
              {folder.isOpen ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-white/40" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />
              )}
              {folder.isOpen ? (
                <FolderOpen className="h-4 w-4 shrink-0 text-accent" />
              ) : (
                <Folder className="h-4 w-4 shrink-0 text-accent" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {folder.name}
                </p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">
                  {pluralize(childFolders.length + folderNotes.length, "item")}
                </p>
              </div>
            </button>
            <button
              type="button"
              aria-label="Delete folder"
              onClick={() => removeFolder(folder.id)}
              className="shrink-0 rounded-md p-1 text-white/28 opacity-0 transition hover:bg-white/8 hover:text-white group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {folder.isOpen && (
          <div
            className="ml-4 space-y-1 border-l border-Cborder/55 pl-2"
            onDragOver={activateFolderDropTarget}
            onDrop={handleFolderDrop}
          >
            {childFolders.map((childFolder) => renderFolderNode(childFolder, depth + 1))}
            {folderNotes.map((note, index) => renderNoteRow(note, folder.id, index))}
            {childFolders.length === 0 && folderNotes.length === 0 && (
              <div
                className="rounded-lg border border-dashed border-Cborder/70 px-3 py-2.5 text-xs text-white/35"
              >
                Empty folder
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

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

      <aside className="flex min-h-[26rem] min-w-0 flex-col rounded-3xl border border-Cborder bg-panel/90 p-5 xl:sticky xl:top-6 xl:max-h-[calc(100vh-7rem)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <StickyNote className="h-4 w-4 shrink-0 text-accent" />
            <div className="min-w-0">
              <p className="font-semibold text-white">Notes</p>
              <div className="mt-1 space-y-0.5 text-xs text-white/45">
                <p>{noteCountText}</p>
                {folderCountText && <p className="text-white/28">{folderCountText}</p>}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Create note"
              onClick={openCreateNoteComposer}
              className="rounded-lg border border-Cborder bg-light-panel/80 p-2 text-white/70 transition hover:bg-light-panel hover:text-white"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Create folder"
              onClick={openFolderComposer}
              className="rounded-lg border border-Cborder bg-light-panel/80 p-2 text-white/70 transition hover:bg-light-panel hover:text-white"
            >
              <FolderPlus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end">
          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-Cborder bg-light-panel/70 px-2.5 py-2 text-[11px] text-white/60">
            <ArrowUpDown className="h-3.5 w-3.5 text-accent" />
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="w-[4.6rem] bg-transparent uppercase tracking-[0.14em] outline-none"
              aria-label="Sort notes"
            >
              <option value="manual">Manual</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
        </div>

        <div className="mt-3 px-1 text-[11px] text-white/35">
          {canDragItems
            ? "Drag notes or folders to reorder and nest them."
            : "Switch back to Manual sort to drag notes and folders."}
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-hidden">
          <div className="custom-scroll h-full overflow-y-auto pr-1">
            <section
              onDragOver={(event) => {
                if (!dragState || !canDragItems || dragState.kind !== "folder") {
                  return;
                }

                event.preventDefault();
                setDropTarget("folder-root");
              }}
              onDrop={(event) => {
                if (!dragState || !canDragItems || dragState.kind !== "folder") {
                  return;
                }

                event.preventDefault();
                dropIntoRoot();
              }}
              className={cn(
                "space-y-1 rounded-xl transition",
                dropTarget === "folder-root" ? "bg-light-panel/30" : "",
              )}
            >
              {rootFolders.length > 0 && (
                <>
                  <div className="px-2 pb-1 text-[10px] uppercase tracking-[0.22em] text-white/28">
                    Folders
                  </div>
                  {rootFolders.map((folder) => renderFolderNode(folder))}
                </>
              )}
            </section>

            {(rootNotes.length > 0 || notes.length === 0) && (
              <section className={cn("space-y-1", rootFolders.length > 0 ? "mt-4" : "")}>
                {rootNotes.length > 0 && (
                  <>
                    <div className="flex items-center justify-between px-2 pb-1">
                      <span className="text-[10px] uppercase tracking-[0.22em] text-white/28">
                        Unfiled
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.18em] text-white/22">
                        {rootNotes.length}
                      </span>
                    </div>

                    <div
                      onDragOver={(event) => {
                        if (!dragState || !canDragItems) {
                          return;
                        }

                        event.preventDefault();
                        setDropTarget("root");
                      }}
                      onDrop={(event) => {
                        if (!dragState || !canDragItems) {
                          return;
                        }

                        event.preventDefault();
                        dropIntoRoot();
                      }}
                      className={cn(
                        "space-y-1 rounded-xl border p-2 transition",
                        dropTarget === "root"
                          ? "border-accent/70 bg-light-panel/55 shadow-[0_0_0_1px_rgba(115,232,196,0.24)]"
                          : "border-Cborder/60 bg-light-panel/20",
                      )}
                    >
                      {rootNotes.map((note, index) => renderNoteRow(note, null, index))}
                    </div>
                  </>
                )}

                {notes.length === 0 && (
                  <div className="px-2 py-1 text-sm text-white/35">
                    No current notes.
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </aside>

      {composerMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeComposer();
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-Cborder bg-panel p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-white">
                  {composerMode === "note"
                    ? editingNoteId
                      ? "Edit note"
                      : "Create note"
                    : "Create folder"}
                </p>
                <p className="mt-1 text-sm text-white/45">
                  {composerMode === "note"
                    ? "Add a name and a short description."
                    : "Give this folder a name for grouping notes."}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close composer"
                onClick={closeComposer}
                className="rounded-md p-1 text-white/40 transition hover:bg-white/8 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {composerMode === "note" ? (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-white/35">
                    Name
                  </label>
                  <input
                    type="text"
                    value={noteDraft.title}
                    onChange={(event) =>
                      setNoteDraft((prev) => ({
                        ...prev,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Release checklist"
                    className="w-full rounded-xl border border-Cborder bg-light-panel/70 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-white/35">
                    Description
                  </label>
                  <textarea
                    value={noteDraft.description}
                    onChange={(event) =>
                      setNoteDraft((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Add context, tasks, or reminders for this note."
                    rows={5}
                    className="w-full resize-none rounded-xl border border-Cborder bg-light-panel/70 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-5">
                <label className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-white/35">
                  Folder Name
                </label>
                <input
                  type="text"
                  value={folderDraft}
                  onChange={(event) => setFolderDraft(event.target.value)}
                  placeholder="Design references"
                  className="w-full rounded-xl border border-Cborder bg-light-panel/70 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25"
                />
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeComposer}
                className="rounded-lg border border-Cborder px-3 py-2 text-sm text-white/65 transition hover:bg-light-panel hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={composerMode === "note" ? saveNote : addFolder}
                className="rounded-lg border border-Cborder bg-light-panel px-3 py-2 text-sm font-medium text-white transition hover:bg-seperator"
              >
                {composerMode === "note"
                  ? editingNoteId
                    ? "Save note"
                    : "Create note"
                  : "Create folder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
