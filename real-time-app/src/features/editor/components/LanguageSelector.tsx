import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import { useState } from "react";

type Language = {
  id: number;
  name: string;
};

type Props = {
  selected: Language;
  onChange: (language: Language) => void;
};

const languages: Language[] = [
  { id: 1, name: "Python" },
  { id: 2, name: "C" },
  { id: 3, name: "Java" },
  { id: 4, name: "C++" },
  { id: 5, name: "Golang" },
  { id: 6, name: "Rust" },
  { id: 7, name: "TypeScript" },
];

export default function LanguageSelector({ selected, onChange }: Props) {
  const [query, setQuery] = useState("");

  const filteredLanguage =
    query === ""
      ? languages
      : languages.filter((lang: Language) => {
          return lang.name.toLowerCase().includes(query.toLowerCase());
        });

  return (
    <div>
      <Combobox
        value={selected}
        onChange={onChange}
        onClose={() => setQuery("")}
      >
        <div className="relative">
          <ComboboxInput
            readOnly
            className={clsx(
              "w-full rounded-lg border-none bg-white/5 py-1.5 pr-8 pl-3 text-sm/6 text-white",
              "focus:not-data-focus:outline-none data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-white/25"
            )}
            displayValue={(lang: Language) => lang?.name}
            onChange={(event) => setQuery(event.target.value)}
          />
          <ComboboxButton className="group absolute inset-y-0 right-0 px-2.5">
            <ChevronDownIcon className="size-4 fill-white/60 group-data-hover:fill-white" />
          </ComboboxButton>
        </div>

        <ComboboxOptions
          anchor="bottom"
          transition
          className={clsx(
            "w-(--input-width) rounded-xl border border-white/5 bg-[#1e1e1e] p-1 [--anchor-gap:--spacing(1)] empty:invisible",
            "transition duration-100 ease-in data-leave:data-closed:opacity-0"
          )}
        >
          {filteredLanguage.map((lang: Language) => (
            <ComboboxOption
              key={lang.id}
              value={lang}
              className="group flex cursor-default items-center gap-2 rounded-lg px-3 py-1.5 select-none data-focus:bg-white/10"
            >
              <CheckIcon className="invisible size-4 fill-white group-data-selected:visible" />
              <div className="text-sm/6 text-white">{lang.name}</div>
            </ComboboxOption>
          ))}
        </ComboboxOptions>
      </Combobox>
    </div>
  );
}
