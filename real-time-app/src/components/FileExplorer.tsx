import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileText,
  FolderPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import folderClosed from "@/assets/folder.svg";
import folderOpen from "@/assets/folder-open.svg";

type ExplorerNode = {
  id: string;
  name: string;
  type: "file" | "directory";
  children?: ExplorerNode[];
};

const initialTree: ExplorerNode[] = [
  {
    id: "src",
    name: "src",
    type: "directory",
    children: [
      { id: "src-main", name: "main.tsx", type: "file" },
      { id: "src-app", name: "App.tsx", type: "file" },
      {
        id: "src-components",
        name: "components",
        type: "directory",
        children: [
          { id: "src-components-navbar", name: "Navbar.tsx", type: "file" },
          { id: "src-components-textbox", name: "textbox.tsx", type: "file" },
        ],
      },
    ],
  },
  {
    id: "backend",
    name: "backend",
    type: "directory",
    children: [
      { id: "backend-main", name: "main.go", type: "file" },
      { id: "backend-room", name: "room_manager.go", type: "file" },
    ],
  },
  {
    id: "docs",
    name: "docs",
    type: "directory",
    children: [{ id: "docs-readme", name: "README.md", type: "file" }],
  },
];

function countNodes(nodes: ExplorerNode[], type: ExplorerNode["type"]): number {
  return nodes.reduce((count, node) => {
    const childCount =
      node.type === "directory" && node.children
        ? countNodes(node.children, type)
        : 0;
    return count + childCount + (node.type === type ? 1 : 0);
  }, 0);
}

function appendNode(
  nodes: ExplorerNode[],
  parentId: string | null,
  nextNode: ExplorerNode
): ExplorerNode[] {
  if (!parentId) {
    return [...nodes, nextNode];
  }

  return nodes.map((node) => {
    if (node.id === parentId && node.type === "directory") {
      return {
        ...node,
        children: [...(node.children ?? []), nextNode],
      };
    }

    if (node.type === "directory" && node.children) {
      return {
        ...node,
        children: appendNode(node.children, parentId, nextNode),
      };
    }

    return node;
  });
}

function findSelectedDirectory(
  nodes: ExplorerNode[],
  selectedId: string | null
): string | null {
  if (!selectedId) {
    return null;
  }

  for (const node of nodes) {
    if (node.id === selectedId && node.type === "directory") {
      return node.id;
    }
    if (node.type === "directory" && node.children) {
      const found = findSelectedDirectory(node.children, selectedId);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

export default function FileExplorer() {
  const [tree, setTree] = useState(initialTree);
  const [openRepos, setOpenRepos] = useState<Record<string, boolean>>({
    src: true,
    backend: true,
  });
  const [selectedId, setSelectedId] = useState<string | null>("src-components");
  const repoFileCount = useMemo(() => countNodes(tree, "file"), [tree]);

  const toggleRepo = (repo: string) =>
    setOpenRepos((prev) => ({ ...prev, [repo]: !prev[repo] }));

  const createNode = (type: ExplorerNode["type"]) => {
    const nextIndex = countNodes(tree, type) + 1;
    return {
      id: `${type}-${Date.now()}-${nextIndex}`,
      name:
        type === "directory"
          ? `new-folder-${nextIndex}`
          : `untitled-${nextIndex}.ts`,
      type,
      children: type === "directory" ? [] : undefined,
    } satisfies ExplorerNode;
  };

  const handleCreate = (type: ExplorerNode["type"]) => {
    const nextNode = createNode(type);
    const parentId = findSelectedDirectory(tree, selectedId);

    setTree((prev) => appendNode(prev, parentId, nextNode));
    setSelectedId(nextNode.id);

    if (parentId) {
      setOpenRepos((prev) => ({ ...prev, [parentId]: true }));
    }
    if (nextNode.type === "directory") {
      setOpenRepos((prev) => ({ ...prev, [nextNode.id]: true }));
    }
  };

  const renderNode = (node: ExplorerNode, depth = 0) => {
    const isOpen = !!openRepos[node.id];
    const isSelected = selectedId === node.id;

    return (
      <div key={node.id}>
        <button
          onClick={() => {
            setSelectedId(node.id);
            if (node.type === "directory") {
              toggleRepo(node.id);
            }
          }}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm outline-none transition",
            "hover:bg-light-panel/80",
            isSelected ? "bg-light-panel text-white" : "text-white/78"
          )}
          style={{ paddingLeft: `${12 + depth * 14}px` }}
        >
          {node.type === "directory" ? (
            <>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-accent" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-accent" />
              )}
              <img
                src={isOpen ? folderOpen : folderClosed}
                className="h-4 w-4 shrink-0"
              />
            </>
          ) : (
            <>
              <span className="w-4 shrink-0" />
              <FileText className="h-4 w-4 shrink-0 text-accent/80" />
            </>
          )}
          <span className="truncate">{node.name}</span>
        </button>

        {node.type === "directory" && isOpen && node.children && (
          <div className="mt-1 flex flex-col gap-1">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3 px-1 text-sm">
      <div className="mb-1 flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Files</p>
          <p className="text-xs text-white/45">{repoFileCount} files</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="New file"
            title="New file"
            onClick={() => handleCreate("file")}
            className="rounded-md border border-Cborder bg-light-panel p-2 text-white/75 transition hover:text-white hover:bg-white/8"
          >
            <FilePlus2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="New directory"
            title="New directory"
            onClick={() => handleCreate("directory")}
            className="rounded-md border border-Cborder bg-light-panel p-2 text-white/75 transition hover:text-white hover:bg-white/8"
          >
            <FolderPlus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1">{tree.map((node) => renderNode(node))}</div>
    </div>
  );
}
