"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

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

export default function WorkspaceSwitcher() {
  const [selectedWorkspace, setSelectedWorkspace] = useState(workspaces[0]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center justify-between gap-2 rounded-xl bg-seperator px-3 py-3">
        <div className="flex items-center gap-2 overflow-hidden">
          <Avatar className="rounded-lg h-8 w-8 shrink-0">
            <AvatarFallback className="rounded-lg bg-Cborder text-primary-foreground">
              {selectedWorkspace.name[0]}
            </AvatarFallback>
          </Avatar>
          <div className="text-start flex flex-col gap-1 leading-none overflow-hidden">
            <span className="text-sm leading-none font-semibold truncate">
              {selectedWorkspace.name}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {selectedWorkspace.createdBy}
            </span>
          </div>
        </div>
        <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-52 text-white bg-Cborder border-2 border-light-panel"
        align="start"
      >
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => setSelectedWorkspace(workspace)}
            className="data-[highlighted]:bg-white/10 data-[highlighted]:text-white hover:bg-white/10 text-white cursor-pointer outline-none"
          >
            <div className="flex items-center gap-2">
              <Avatar className="rounded-md h-8 w-8">
                <AvatarFallback className="rounded-md bg-white/35 text-foreground">
                  {workspace.name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span>{workspace.name}</span>
                <span className="text-xs text-white/35">
                  {workspace.createdBy}
                </span>
              </div>
            </div>
            {selectedWorkspace.id === workspace.id && (
              <Check className="ml-auto" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
