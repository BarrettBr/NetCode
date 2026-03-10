import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SelectScrollable() {
  return (
    <Select defaultValue="main">
      <SelectTrigger className="h-auto w-full max-w-full truncate border-none bg-transparent px-0 py-0 text-left text-sm font-semibold text-white shadow-none outline-none hover:bg-transparent focus-visible:ring-0">
        <SelectValue placeholder="Select a branch" />
      </SelectTrigger>
      <SelectContent className="border border-Cborder bg-light-panel text-white">
        <SelectGroup>
          <SelectItem
            value="main"
            className="cursor-pointer text-white data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
          >
            main
          </SelectItem>
          <SelectItem
            value="ui-refresh"
            className="cursor-pointer text-white data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
          >
            ui-refresh
          </SelectItem>
          <SelectItem
            value="concurrency-fix"
            className="cursor-pointer text-white data-[highlighted]:bg-white/10 data-[highlighted]:text-white"
          >
            concurrency-fix
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
