import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type DashboardNote = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  folderId: string | null;
};

export type NoteFolder = {
  id: string;
  name: string;
  createdAt: string;
  noteIds: string[];
  childFolderIds: string[];
  parentFolderId: string | null;
  isOpen: boolean;
};

export type NotesStore = {
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

export type SortMode = "manual" | "newest" | "oldest";

export type DragState =
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

export type ComposerMode = "note" | "folder" | null;

export type NoteDraft = {
  title: string;
  description: string;
};

export type UseDashboardNotesResult = {
  notes: DashboardNote[];
  folders: NoteFolder[];
  rootFolders: NoteFolder[];
  rootNotes: DashboardNote[];
  notesByFolder: Map<string, DashboardNote[]>;
  noteCountText: string;
  folderCountText: string | null;
  sortMode: SortMode;
  setSortMode: React.Dispatch<React.SetStateAction<SortMode>>;
  canDragItems: boolean;
  dragState: DragState | null;
  setDragState: React.Dispatch<React.SetStateAction<DragState | null>>;
  dropTarget: string | null;
  setDropTarget: React.Dispatch<React.SetStateAction<string | null>>;
  composerMode: ComposerMode;
  editingNoteId: string | null;
  noteDraft: NoteDraft;
  setNoteDraft: React.Dispatch<React.SetStateAction<NoteDraft>>;
  folderDraft: string;
  setFolderDraft: React.Dispatch<React.SetStateAction<string>>;
  getFoldersForParent: (parentFolderId: string | null) => NoteFolder[];
  openCreateNoteComposer: () => void;
  openEditNoteComposer: (note: DashboardNote) => void;
  openFolderComposer: () => void;
  closeComposer: () => void;
  saveNote: () => void;
  addFolder: () => void;
  removeNote: (id: string) => void;
  removeFolder: (folderId: string) => void;
  toggleFolder: (folderId: string) => void;
  clearDragState: () => void;
  moveDraggedItem: (
    destinationFolderId: string | null,
    noteCount: number,
    childFolderCount: number
  ) => void;
  dropIntoRoot: () => void;
  dropIntoFolder: (
    folderId: string,
    noteCount: number,
    childFolderCount: number
  ) => void;
};

const NOTES_STORAGE_KEY = "netcode-workspace-notes";

const noteDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function createId(prefix: "note" | "folder") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function pluralize(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function getNoteTitle(text: string) {
  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine || "Untitled note";
}

export function getNotePreview(text: string) {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > 72 ? `${collapsed.slice(0, 72)}...` : collapsed;
}

export function formatNoteDate(createdAt: string) {
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
        typeof item.createdAt === "string"
    )
  );
}

function normalizeStoredNote(note: unknown): DashboardNote | null {
  if (!note || typeof note !== "object") {
    return null;
  }

  const candidate = note as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.createdAt !== "string"
  ) {
    return null;
  }

  const folderId =
    typeof candidate.folderId === "string" ? candidate.folderId : null;

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
        Array.isArray((folder as Record<string, unknown>).noteIds)
    )
    .map((folder) => ({
      id: folder.id as string,
      name: folder.name as string,
      createdAt: folder.createdAt as string,
      noteIds: (folder.noteIds as unknown[]).filter(
        (noteId): noteId is string => typeof noteId === "string"
      ),
      childFolderIds: Array.isArray(folder.childFolderIds)
        ? folder.childFolderIds.filter(
            (folderId): folderId is string => typeof folderId === "string"
          )
        : [],
      parentFolderId:
        typeof folder.parentFolderId === "string" ? folder.parentFolderId : null,
      isOpen: folder.isOpen !== false,
    }));

  const folderIds = new Set(rawFolders.map((folder) => folder.id));
  const normalizedNotes = notes.map((note) => ({
    ...note,
    folderId:
      note.folderId && folderIds.has(note.folderId) ? note.folderId : null,
  }));

  const foldersWithParents = rawFolders.map((folder) => ({
    ...folder,
    parentFolderId:
      folder.parentFolderId && folderIds.has(folder.parentFolderId)
        ? folder.parentFolderId
        : null,
    childFolderIds: folder.childFolderIds.filter(
      (childFolderId) => childFolderId !== folder.id && folderIds.has(childFolderId)
    ),
    noteIds: folder.noteIds.filter((noteId) => noteIds.has(noteId)),
  }));

  const folderNoteLookup = new Set(
    foldersWithParents.flatMap((folder) => folder.noteIds)
  );
  const foldersWithNotes = foldersWithParents.map((folder) => {
    const missingNotes = normalizedNotes
      .filter((note) => note.folderId === folder.id && !folderNoteLookup.has(note.id))
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
          !folder.childFolderIds.includes(childFolder.id)
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
      !assignedRootNoteIds.has(noteId)
  );
  const missingRootNotes = normalizedNotes
    .filter((note) => note.folderId === null && !rootOrder.includes(note.id))
    .map((note) => note.id);

  const assignedChildFolderIds = new Set(
    folders.flatMap((folder) => folder.childFolderIds)
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
        (folder) => folder.id === folderId && folder.parentFolderId === null
      )
  );
  const missingRootFolders = folders
    .filter(
      (folder) =>
        folder.parentFolderId === null && !rootFolderOrder.includes(folder.id)
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
  mode: Exclude<SortMode, "manual">
) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();
    return mode === "newest" ? rightTime - leftTime : leftTime - rightTime;
  });
}

export function collectDescendantFolderIds(
  folders: NoteFolder[],
  folderId: string,
  bucket = new Set<string>()
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
  destinationIndex: number
): NotesStore {
  const notes = store.notes.map((note) =>
    note.id === dragState.itemId ? { ...note, folderId: destinationFolderId } : note
  );
  const rootOrder = insertAt(
    store.rootOrder.filter((noteId) => noteId !== dragState.itemId),
    destinationFolderId === null ? destinationIndex : store.rootOrder.length,
    dragState.itemId
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
  destinationIndex: number
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
    dragState.itemId
  );

  const folders = store.folders.map((folder) => {
    let childFolderIds = folder.childFolderIds.filter(
      (folderId) => folderId !== dragState.itemId
    );

    if (folder.id === destinationParentFolderId) {
      childFolderIds = insertAt(
        childFolderIds,
        destinationIndex,
        dragState.itemId
      );
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

export function useDashboardNotes(): UseDashboardNotesResult {
  const [notesStore, setNotesStore] = useState<NotesStore>(createDefaultNotesStore);
  const [sortMode, setSortMode] = useState<SortMode>("manual");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [composerMode, setComposerMode] = useState<ComposerMode>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<NoteDraft>({
    title: "",
    description: "",
  });
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

  const closeComposer = useCallback(() => {
    setComposerMode(null);
    setEditingNoteId(null);
    setNoteDraft({ title: "", description: "" });
    setFolderDraft("");
  }, []);

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
  }, [closeComposer, composerMode]);

  const noteMap = useMemo(
    () => new Map(notes.map((note) => [note.id, note])),
    [notes]
  );
  const folderMap = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder])),
    [folders]
  );
  const canDragItems = sortMode === "manual";

  const getFoldersForParent = useCallback(
    (parentFolderId: string | null) => {
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
        sortMode
      );
    },
    [folderMap, folders, notesStore.rootFolderOrder, sortMode]
  );

  const rootFolders = useMemo(() => getFoldersForParent(null), [getFoldersForParent]);

  const rootNotes = useMemo(() => {
    if (sortMode === "manual") {
      return notesStore.rootOrder
        .map((noteId) => noteMap.get(noteId))
        .filter((note): note is DashboardNote => Boolean(note));
    }

    return sortByCreatedAt(
      notes.filter((note) => note.folderId === null),
      sortMode
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
              sortMode
            );

      grouped.set(folder.id, folderNotes);
    });

    return grouped;
  }, [folders, noteMap, notes, sortMode]);

  const noteCountText = pluralize(notes.length, "note");
  const folderCountText =
    folders.length > 0 ? pluralize(folders.length, "folder") : null;

  const openCreateNoteComposer = useCallback(() => {
    setEditingNoteId(null);
    setNoteDraft({ title: "", description: "" });
    setComposerMode("note");
  }, []);

  const openEditNoteComposer = useCallback((note: DashboardNote) => {
    setEditingNoteId(note.id);
    setNoteDraft({
      title: note.title,
      description: note.description,
    });
    setComposerMode("note");
  }, []);

  const openFolderComposer = useCallback(() => {
    setFolderDraft("");
    setComposerMode("folder");
  }, []);

  const saveNote = useCallback(() => {
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
            : note
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
  }, [closeComposer, editingNoteId, noteDraft.description, noteDraft.title]);

  const addFolder = useCallback(() => {
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
  }, [closeComposer, folderDraft, folders.length]);

  const removeNote = useCallback((id: string) => {
    setNotesStore((prev) => ({
      ...prev,
      notes: prev.notes.filter((note) => note.id !== id),
      folders: prev.folders.map((folder) => ({
        ...folder,
        noteIds: folder.noteIds.filter((noteId) => noteId !== id),
      })),
      rootOrder: prev.rootOrder.filter((noteId) => noteId !== id),
    }));
  }, []);

  const removeFolder = useCallback((folderId: string) => {
    setNotesStore((prev) => {
      const folder = prev.folders.find((item) => item.id === folderId);
      if (!folder) {
        return prev;
      }

      return {
        notes: prev.notes.map((note) =>
          note.folderId === folderId ? { ...note, folderId: null } : note
        ),
        folders: prev.folders
          .filter((item) => item.id !== folderId)
          .map((item) => ({
            ...item,
            childFolderIds: item.childFolderIds.filter(
              (childId) => childId !== folderId
            ),
            parentFolderId:
              item.parentFolderId === folderId ? null : item.parentFolderId,
          })),
        rootOrder: [...folder.noteIds, ...prev.rootOrder],
        rootFolderOrder: [
          ...folder.childFolderIds,
          ...prev.rootFolderOrder.filter((itemId) => itemId !== folderId),
        ],
      };
    });
  }, []);

  const toggleFolder = useCallback((folderId: string) => {
    setNotesStore((prev) => ({
      ...prev,
      folders: prev.folders.map((folder) =>
        folder.id === folderId ? { ...folder, isOpen: !folder.isOpen } : folder
      ),
    }));
  }, []);

  const clearDragState = useCallback(() => {
    setDragState(null);
    setDropTarget(null);
  }, []);

  const moveDraggedItem = useCallback(
    (
      destinationFolderId: string | null,
      noteCount: number,
      childFolderCount: number
    ) => {
      if (!dragState || !canDragItems) {
        return;
      }

      setNotesStore((prev) =>
        dragState.kind === "note"
          ? moveNote(prev, dragState, destinationFolderId, noteCount)
          : moveFolder(prev, dragState, destinationFolderId, childFolderCount)
      );
      clearDragState();
    },
    [canDragItems, clearDragState, dragState]
  );

  const dropIntoRoot = useCallback(() => {
    if (!dragState || !canDragItems) {
      return;
    }

    moveDraggedItem(null, rootNotes.length, rootFolders.length);
  }, [canDragItems, dragState, moveDraggedItem, rootFolders.length, rootNotes.length]);

  const dropIntoFolder = useCallback(
    (folderId: string, noteCount: number, childFolderCount: number) => {
      if (!dragState || !canDragItems) {
        return;
      }

      moveDraggedItem(folderId, noteCount, childFolderCount);
    },
    [canDragItems, dragState, moveDraggedItem]
  );

  return {
    notes,
    folders,
    rootFolders,
    rootNotes,
    notesByFolder,
    noteCountText,
    folderCountText,
    sortMode,
    setSortMode,
    canDragItems,
    dragState,
    setDragState,
    dropTarget,
    setDropTarget,
    composerMode,
    editingNoteId,
    noteDraft,
    setNoteDraft,
    folderDraft,
    setFolderDraft,
    getFoldersForParent,
    openCreateNoteComposer,
    openEditNoteComposer,
    openFolderComposer,
    closeComposer,
    saveNote,
    addFolder,
    removeNote,
    removeFolder,
    toggleFolder,
    clearDragState,
    moveDraggedItem,
    dropIntoRoot,
    dropIntoFolder,
  };
}
