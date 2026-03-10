import type React from "react";
import {
  FONT_FAMILY_OPTIONS,
  clampFontSize,
  clampTabSize,
  type EditorSettings,
} from "@/lib/editorSettings";

type Props = {
  editorSettings: EditorSettings;
  setEditorSettings: React.Dispatch<React.SetStateAction<EditorSettings>>;
};

export default function Settings({
  editorSettings,
  setEditorSettings,
}: Props) {
  const updateFontSize = (value: string) => {
    setEditorSettings((prev) => ({
      ...prev,
      fontSize: clampFontSize(Number(value)),
    }));
  };

  const updateFontFamily = (value: EditorSettings["fontFamily"]) => {
    setEditorSettings((prev) => ({
      ...prev,
      fontFamily: value,
    }));
  };

  const updateTabSize = (value: string) => {
    setEditorSettings((prev) => ({
      ...prev,
      tabSize: clampTabSize(Number(value)),
    }));
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 p-6 font-fira text-white">
      <header className="max-w-2xl space-y-3">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/80">
          Workspace settings
        </p>
        <h1 className="text-4xl leading-tight text-white">Editor preferences</h1>
        <p className="text-base leading-8 text-white/55">
          These settings apply to the code editor inside this workspace.
        </p>
      </header>

      <section className="rounded-3xl border border-Cborder bg-panel/80 p-6">
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <label
              htmlFor="workspace-font-size"
              className="mb-2 block text-sm text-white/70"
            >
              Font size
            </label>
            <div className="relative">
              <input
                id="workspace-font-size"
                type="number"
                min={12}
                max={24}
                step={1}
                value={editorSettings.fontSize}
                onChange={(e) => updateFontSize(e.target.value)}
                className="input-number-clean w-full rounded-xl border border-Cborder bg-light-panel px-3 py-3 pr-12 text-white outline-none"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/35">
                px
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="workspace-font-family"
              className="mb-2 block text-sm text-white/70"
            >
              Font family
            </label>
            <div className="relative">
              <select
                id="workspace-font-family"
                value={editorSettings.fontFamily}
                onChange={(e) =>
                  updateFontFamily(e.target.value as EditorSettings["fontFamily"])
                }
                className="w-full appearance-none rounded-xl border border-Cborder bg-light-panel px-3 py-3 pr-10 text-white outline-none"
              >
                {FONT_FAMILY_OPTIONS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/45">
                {"\u25BC"}
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="workspace-tab-size"
              className="mb-2 block text-sm text-white/70"
            >
              Tab size
            </label>
            <input
              id="workspace-tab-size"
              type="number"
              min={2}
              max={8}
              step={1}
              value={editorSettings.tabSize}
              onChange={(e) => updateTabSize(e.target.value)}
              className="input-number-clean w-full rounded-xl border border-Cborder bg-light-panel px-3 py-3 text-white outline-none"
            />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-Cborder bg-panel/60 p-6">
        <div className="mb-4">
          <h2 className="text-2xl text-white">Other settings</h2>
          <p className="mt-2 text-sm text-white/45">
            These are placeholders for future workspace preferences.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-Cborder bg-light-panel/60 p-4">
            <p className="text-sm uppercase tracking-[0.18em] text-white/35">Theme</p>
            <p className="mt-3 text-white/75">Dark</p>
          </div>
          <div className="rounded-2xl border border-Cborder bg-light-panel/60 p-4">
            <p className="text-sm uppercase tracking-[0.18em] text-white/35">Key bindings</p>
            <p className="mt-3 text-white/75">VSCode</p>
          </div>
          <div className="rounded-2xl border border-Cborder bg-light-panel/60 p-4">
            <p className="text-sm uppercase tracking-[0.18em] text-white/35">Autosave</p>
            <p className="mt-3 text-white/75">Mocked</p>
          </div>
          <div className="rounded-2xl border border-Cborder bg-light-panel/60 p-4">
            <p className="text-sm uppercase tracking-[0.18em] text-white/35">Permissions</p>
            <p className="mt-3 text-white/75">Mocked</p>
          </div>
        </div>
      </section>
    </div>
  );
}
