export type EditorSessionState = {
  text: string;
  outputText: string;
  serverVersion: number;
  localUID: number;
  hasInitialSync: boolean;
  syncVersion: number;
};

export function createInitialEditorSessionState(): EditorSessionState {
  return {
    text: "",
    outputText: "",
    serverVersion: 0,
    localUID: 0,
    hasInitialSync: false,
    syncVersion: 0,
  };
}
