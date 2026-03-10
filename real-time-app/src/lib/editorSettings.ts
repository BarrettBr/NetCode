export type EditorFontFamily =
  | "Fira Code"
  | "JetBrains Mono"
  | "Source Code Pro"
  | "IBM Plex Mono";

export type EditorSettings = {
  fontSize: number;
  fontFamily: EditorFontFamily;
  tabSize: number;
  terminalDock: "bottom" | "right";
};

export const FONT_FAMILY_OPTIONS: EditorFontFamily[] = [
  "Fira Code",
  "JetBrains Mono",
  "Source Code Pro",
  "IBM Plex Mono",
];

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontSize: 14,
  fontFamily: "Fira Code",
  tabSize: 4,
  terminalDock: "bottom",
};

export function clampFontSize(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_EDITOR_SETTINGS.fontSize;
  }
  return Math.min(24, Math.max(12, Math.round(value)));
}

export function clampTabSize(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_EDITOR_SETTINGS.tabSize;
  }
  return Math.min(8, Math.max(2, Math.round(value)));
}
