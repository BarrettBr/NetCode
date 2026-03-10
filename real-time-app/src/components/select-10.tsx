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
      <SelectTrigger className="w-full max-w-full truncate border-none outline-none bg-seperator">
        <SelectValue placeholder="Select a branch" />
      </SelectTrigger>
      <SelectContent className="bg-Cborder text-white border-none">
        <SelectGroup>
          <SelectItem value="main">main</SelectItem>
          <SelectItem value="ui-refresh">ui-refresh</SelectItem>
          <SelectItem value="concurrency-fix">concurrency-fix</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
