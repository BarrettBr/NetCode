export type TerminalScope = "private" | "shared";
export type TerminalStatus = "idle" | "running" | "closed";

export type TerminalTab = {
  id: string;
  scope: TerminalScope;
  title: string;
  status: TerminalStatus;
  buffer: string;
  commandDraft: string;
};

export type ServerTerminalTab = {
  id: string;
  scope: TerminalScope;
  status?: TerminalStatus;
  buffer?: string;
  commandDraft?: string;
};

export type TerminalCollection = Record<TerminalScope, TerminalTab[]>;
export type ActiveTerminalIds = Record<TerminalScope, string | null>;

export const EMPTY_TABS: TerminalCollection = {
  private: [],
  shared: [],
};

export const EMPTY_ACTIVE_IDS: ActiveTerminalIds = {
  private: null,
  shared: null,
};

export const TERMINAL_PROMPT = "netcode:$ ";

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);

const OSC_BELL_PATTERN = new RegExp(`${ESC}\\][^${BEL}]*${BEL}`, "g");
const OSC_ST_PATTERN = new RegExp(`${ESC}\\][^${ESC}]*${ESC}\\\\`, "g");
const CSI_PATTERN = new RegExp(`${ESC}\\[[0-9;?]*[ -/]*[@-~]`, "g");
const SINGLE_ESCAPE_PATTERN = new RegExp(`${ESC}[@-_]`, "g");
const DUPLICATE_PROMPT_PATTERN = new RegExp(
  `(?:${TERMINAL_PROMPT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} ?){2,}`,
  "g",
);

export function sanitizeTerminalText(value: string): string {
  return value
    .replace(OSC_BELL_PATTERN, "")
    .replace(OSC_ST_PATTERN, "")
    .replace(CSI_PATTERN, "")
    .replace(SINGLE_ESCAPE_PATTERN, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "");
}

export function normalizeTabs(
  scope: TerminalScope,
  incoming: ServerTerminalTab[] | undefined,
  previous: TerminalTab[],
): TerminalTab[] {
  const prevById = new Map(previous.map((tab) => [tab.id, tab]));

  return (incoming ?? []).map((tab, index) => {
    const existing = prevById.get(tab.id);
    return {
      id: tab.id,
      scope,
      title: `${index + 1}`,
      status: tab.status ?? existing?.status ?? "idle",
      buffer: sanitizeTerminalText(tab.buffer ?? existing?.buffer ?? ""),
      commandDraft: tab.commandDraft ?? existing?.commandDraft ?? "",
    };
  });
}

export function nextActiveId(
  tabs: TerminalTab[],
  preferredId: string | null,
): string | null {
  if (preferredId && tabs.some((tab) => tab.id === preferredId)) {
    return preferredId;
  }
  return tabs[0]?.id ?? null;
}

export function splitTerminalBuffer(buffer: string) {
  const collapsedBuffer = buffer.replace(DUPLICATE_PROMPT_PATTERN, TERMINAL_PROMPT);
  const trailingPromptMatch = collapsedBuffer.match(/(?:^|\n)(netcode:\$ ?)$/);
  const hasTrailingPrompt =
    Boolean(trailingPromptMatch) && trailingPromptMatch?.index !== undefined
      ? trailingPromptMatch.index + trailingPromptMatch[0].length ===
        collapsedBuffer.length
      : false;

  const prompt = hasTrailingPrompt
    ? trailingPromptMatch?.[1] ?? TERMINAL_PROMPT.trimEnd()
    : "";

  let history = hasTrailingPrompt
    ? collapsedBuffer.slice(0, collapsedBuffer.length - prompt.length)
    : collapsedBuffer;

  history = history.replace(/^netcode:\$ ?(?=netcode:\$ )/, "");

  return {
    history,
    prompt: hasTrailingPrompt ? `${prompt}${prompt.endsWith(" ") ? "" : " "}` : "",
  };
}
