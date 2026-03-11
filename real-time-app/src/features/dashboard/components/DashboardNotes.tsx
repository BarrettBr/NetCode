import type { DragEvent, ReactNode } from "react";
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
import { cn } from "@/lib/utils";
import {
  collectDescendantFolderIds,
  formatNoteDate,
  getNotePreview,
  pluralize,
  type DashboardNote,
  type NoteFolder,
  type SortMode,
  useDashboardNotes,
} from "@/hooks/useDashboardNotes";

export default function DashboardNotes() {
  const {
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
  } = useDashboardNotes();

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
        setDropTarget(null);
        dropIntoNotePosition(folderId, index);
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

  const dropIntoNotePosition = (folderId: string | null, index: number) => {
    if (!dragState || !canDragItems || dragState.kind !== "note") {
      return;
    }

    setDropTarget(null);
    moveDraggedItem(
      folderId,
      Math.max(0, index),
      folderId === null ? rootFolders.length : getFoldersForParent(folderId).length,
    );
  };

  const renderFolderNode = (folder: NoteFolder): ReactNode => {
    const childFolders = getFoldersForParent(folder.id);
    const folderNotes = notesByFolder.get(folder.id) ?? [];
    const isDropTarget = dropTarget === `folder-${folder.id}`;
    const canAcceptFolderDrop =
      !dragState ||
      dragState.kind !== "folder" ||
      (dragState.itemId !== folder.id &&
        !collectDescendantFolderIds(folders, dragState.itemId).has(folder.id));

    const activateFolderDropTarget = (event: DragEvent) => {
      if (!dragState || !canDragItems || !canAcceptFolderDrop) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setDropTarget(`folder-${folder.id}`);
    };

    const handleFolderDrop = (event: DragEvent) => {
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
            {childFolders.map((childFolder) => renderFolderNode(childFolder))}
            {folderNotes.map((note, index) => renderNoteRow(note, folder.id, index))}
            {childFolders.length === 0 && folderNotes.length === 0 && (
              <div className="rounded-lg border border-dashed border-Cborder/70 px-3 py-2.5 text-xs text-white/35">
                Empty folder
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
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
    </>
  );
}
