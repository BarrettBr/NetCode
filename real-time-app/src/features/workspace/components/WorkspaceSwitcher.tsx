"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronsUpDown, GitBranch, Layers3, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const workspaces = [
  {
    id: 1,
    name: "Netcode",
    createdBy: "barrettbrown2012@gmail.com",
  },
  {
    id: 2,
    name: "MonkeChat",
    createdBy: "def@example.com",
  },
  {
    id: 3,
    name: "Other cool Repo",
    createdBy: "ghi@example.com",
  },
];

const branches = ["main", "ui-refresh", "concurrency-fix"] as const;
const INITIAL_REPO_LIMIT = 6;
const INITIAL_BRANCH_LIMIT = 5;
const LOAD_MORE_STEP = 8;

export default function WorkspaceSwitcher() {
  const [selectedWorkspace, setSelectedWorkspace] = useState(workspaces[0]);
  const [selectedBranch, setSelectedBranch] =
    useState<(typeof branches)[number]>("main");
  const [query, setQuery] = useState("");
  const [visibleRepoCount, setVisibleRepoCount] = useState(INITIAL_REPO_LIMIT);
  const [visibleBranchCount, setVisibleBranchCount] =
    useState(INITIAL_BRANCH_LIMIT);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredWorkspaces = useMemo(
    () =>
      workspaces.filter((workspace) => {
        if (!normalizedQuery) {
          return true;
        }

        return [workspace.name, workspace.createdBy].some((value) =>
          value.toLowerCase().includes(normalizedQuery)
        );
      }),
    [normalizedQuery]
  );
  const filteredBranches = useMemo(
    () =>
      branches.filter((branch) =>
        normalizedQuery ? branch.toLowerCase().includes(normalizedQuery) : true
      ),
    [normalizedQuery]
  );
  const visibleWorkspaces = filteredWorkspaces.slice(0, visibleRepoCount);
  const visibleBranches = filteredBranches.slice(0, visibleBranchCount);
  const hasMoreRepos = visibleRepoCount < filteredWorkspaces.length;
  const hasMoreBranches = visibleBranchCount < filteredBranches.length;

  useEffect(() => {
    setVisibleRepoCount(INITIAL_REPO_LIMIT);
    setVisibleBranchCount(INITIAL_BRANCH_LIMIT);
  }, [normalizedQuery]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center justify-between gap-3 rounded-2xl border border-Cborder/65 bg-light-panel/60 px-3.5 py-3 text-left transition hover:border-Cborder hover:bg-light-panel/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20">
        <div className="flex min-w-0 items-center gap-3 overflow-hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-Cborder/75 text-tab-active">
            <Layers3 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35">
              Repo / Branch
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-white">
              {selectedWorkspace.name}
            </p>
            <p className="mt-0.5 truncate text-xs text-white/42">
              {selectedBranch}
            </p>
          </div>
        </div>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-white/35" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-[min(19rem,calc(100vw-2rem))] max-h-[min(75vh,34rem)] overflow-hidden rounded-2xl border border-Cborder bg-panel/95 p-2 text-white shadow-[0_20px_48px_rgba(0,0,0,0.35)] backdrop-blur-md"
        align="start"
        collisionPadding={12}
        sideOffset={10}
      >
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/8 bg-light-panel/70 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-white/35" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search repos or branches"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/28"
          />
        </div>

        <DropdownMenuLabel className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35">
          Repositories
        </DropdownMenuLabel>
        {filteredWorkspaces.length > 0 ? (
          <div className="custom-scroll max-h-[min(34vh,16rem)] overflow-y-auto pr-1">
            {visibleWorkspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => setSelectedWorkspace(workspace)}
                className="cursor-pointer rounded-xl px-2 py-2 text-white outline-none data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
              >
                <div className="flex items-center gap-2">
                  <Avatar className="rounded-md h-8 w-8">
                    <AvatarFallback className="rounded-md bg-white/10 text-white">
                      {workspace.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col">
                    <span>{workspace.name}</span>
                    <span className="truncate text-xs text-white/35">
                      {workspace.createdBy}
                    </span>
                  </div>
                </div>
                {selectedWorkspace.id === workspace.id && (
                  <Check className="ml-auto" />
                )}
              </DropdownMenuItem>
            ))}
          </div>
        ) : (
          <div className="px-2 py-3 text-sm text-white/35">No matching repositories.</div>
        )}
        {hasMoreRepos && (
          <div className="px-2 pt-2">
            <button
              type="button"
              onClick={() => setVisibleRepoCount((count) => count + LOAD_MORE_STEP)}
              className="text-xs font-semibold uppercase tracking-[0.22em] text-tab-active transition hover:text-white"
            >
              View more repos
            </button>
          </div>
        )}
        <DropdownMenuSeparator className="mx-2 my-2 bg-white/8" />
        <DropdownMenuLabel className="flex items-center gap-2 px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35">
          <GitBranch className="h-3.5 w-3.5" />
          Branches
        </DropdownMenuLabel>
        {filteredBranches.length > 0 ? (
          <div className="custom-scroll max-h-[min(24vh,10rem)] overflow-y-auto pr-1">
            {visibleBranches.map((branch) => (
              <DropdownMenuItem
                key={branch}
                onClick={() => setSelectedBranch(branch)}
                className="cursor-pointer rounded-xl px-2 py-2 text-white outline-none data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
              >
                <span className="font-medium">{branch}</span>
                {selectedBranch === branch && <Check className="ml-auto" />}
              </DropdownMenuItem>
            ))}
          </div>
        ) : (
          <div className="px-2 py-3 text-sm text-white/35">No matching branches.</div>
        )}
        {hasMoreBranches && (
          <div className="px-2 pt-2">
            <button
              type="button"
              onClick={() =>
                setVisibleBranchCount((count) => count + LOAD_MORE_STEP)
              }
              className="text-xs font-semibold uppercase tracking-[0.22em] text-tab-active transition hover:text-white"
            >
              View more branches
            </button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
