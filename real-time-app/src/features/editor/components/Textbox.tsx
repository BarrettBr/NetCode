import { useCallback, useEffect, useRef } from "react";
import {
  Compartment,
  EditorSelection,
  EditorState,
  type Extension,
} from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  insertNewlineAndIndent,
} from "@codemirror/commands";
import type { RopeOperation } from "@/hooks/useRopes";
import type { EditorSettings } from "@/lib/editorSettings";

declare global {
  interface Window {
    __NETCODE_EDITOR_EVENTS__?: Array<{
      id: string;
      kind: string;
      text: string;
    }>;
  }
}

type Props = {
  curText: string;
  setText: (ops: RopeOperation[]) => void;
  incomingOp: RopeOperation[];
  syncVersion: number;
  isSynced: boolean;
  editorSettings: EditorSettings;
  id: string;
};

function editorFontFamily(fontFamily: EditorSettings["fontFamily"]): string {
  switch (fontFamily) {
    case "JetBrains Mono":
      return '"JetBrains Mono", "Fira Code", monospace';
    case "Source Code Pro":
      return '"Source Code Pro", "Fira Code", monospace';
    case "IBM Plex Mono":
      return '"IBM Plex Mono", "Fira Code", monospace';
    default:
      return '"Fira Code", monospace';
  }
}

function buildEditorTheme(settings: EditorSettings) {
  return EditorView.theme({
    "&": {
      height: "100%",
      backgroundColor: "#030a0d",
      color: "#d4d4d4",
      fontFamily: editorFontFamily(settings.fontFamily),
      fontSize: `${settings.fontSize}px`,
    },
    ".cm-scroller": {
      overflow: "auto",
      fontFamily: editorFontFamily(settings.fontFamily),
      lineHeight: "24px",
    },
    ".cm-content, .cm-gutterElement": {
      lineHeight: "24px",
    },
    ".cm-content": {
      padding: "12px 0",
      caretColor: "#d4d4d4",
      minHeight: "100%",
    },
    ".cm-line": {
      padding: "0 12px",
    },
    ".cm-gutters": {
      backgroundColor: "#030a0d",
      color: "#888",
      borderRight: "2px solid #213030",
    },
    ".cm-activeLine, .cm-activeLineGutter": {
      backgroundColor: "transparent",
    },
    ".cm-selectionBackground": {
      backgroundColor: "#244b5a !important",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-cursor": {
      borderLeftColor: "#d4d4d4",
    },
    "&.cm-editor.cm-readonly .cm-content": {
      caretColor: "transparent",
    },
  });
}

function buildEditorKeymap(tabSize: number) {
  const softTab = " ".repeat(tabSize);
  return keymap.of([
    {
      key: "Tab",
      run: ({ state, dispatch }) => {
        const changes = state.changeByRange((range) => ({
          changes: {
            from: range.from,
            to: range.to,
            insert: softTab,
          },
          range: EditorSelection.cursor(range.from + softTab.length),
        }));

        dispatch(
          state.update(changes, {
            scrollIntoView: true,
            userEvent: "input",
          }),
        );
        return true;
      },
    },
    { key: "Enter", run: insertNewlineAndIndent },
    ...defaultKeymap,
    ...historyKeymap,
  ]);
}

function Textbox({
  curText,
  setText,
  incomingOp,
  syncVersion,
  isSynced,
  editorSettings,
  id,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const initialDocRef = useRef(curText);
  const initialSettingsRef = useRef(editorSettings);
  const suppressDispatchRef = useRef(false);
  const processedIncomingOps = useRef(0);
  const submitOpsRef = useRef(setText);
  const editableCompartmentRef = useRef(new Compartment());
  const editorThemeCompartmentRef = useRef(new Compartment());
  const tabSizeCompartmentRef = useRef(new Compartment());
  const keymapCompartmentRef = useRef(new Compartment());

  const applyOpToText = useCallback((baseText: string, op: RopeOperation) => {
    if (op.type === "insert") {
      const position = Math.max(0, Math.min(op.pos, baseText.length));
      return baseText.slice(0, position) + op.value + baseText.slice(position);
    }

    const from = Math.max(0, Math.min(op.from, baseText.length));
    const to = Math.max(from, Math.min(op.to, baseText.length));
    return baseText.slice(0, from) + baseText.slice(to);
  }, []);

  const publishDocText = useCallback((docText: string) => {
    if (typeof window === "undefined") {
      return;
    }
    hostRef.current?.setAttribute("data-editor-text", docText);
  }, []);

  const publishEvent = useCallback(
    (kind: string, docText: string) => {
      if (typeof window === "undefined") {
        return;
      }
      window.__NETCODE_EDITOR_EVENTS__ = window.__NETCODE_EDITOR_EVENTS__ ?? [];
      window.__NETCODE_EDITOR_EVENTS__.push({ id, kind, text: docText });
    },
    [id],
  );

  const buildOpsFromDiff = useCallback(
    (previousText: string, nextText: string): RopeOperation[] => {
      if (previousText === nextText) {
        return [];
      }

      let start = 0;
      while (
        start < previousText.length &&
        start < nextText.length &&
        previousText[start] === nextText[start]
      ) {
        start++;
      }

      let previousEnd = previousText.length;
      let nextEnd = nextText.length;
      while (
        previousEnd > start &&
        nextEnd > start &&
        previousText[previousEnd - 1] === nextText[nextEnd - 1]
      ) {
        previousEnd--;
        nextEnd--;
      }

      const ops: RopeOperation[] = [];
      if (previousEnd > start) {
        ops.push({
          event: "text_update",
          type: "delete",
          from: start,
          to: previousEnd,
          version: 0,
          author: 0,
        });
      }

      if (nextEnd > start) {
        ops.push({
          event: "text_update",
          type: "insert",
          pos: start,
          value: nextText.slice(start, nextEnd),
          version: 0,
          author: 0,
        });
      }

      return ops;
    },
    [],
  );

  const syncHostMetadata = useCallback(
    (settings: EditorSettings) => {
      hostRef.current?.setAttribute(
        "data-editor-font-size",
        `${settings.fontSize}`,
      );
      hostRef.current?.setAttribute(
        "data-editor-font-family",
        settings.fontFamily,
      );
      hostRef.current?.setAttribute(
        "data-editor-tab-size",
        `${settings.tabSize}`,
      );
    },
    [],
  );

  const withSuppressedDispatch = useCallback((callback: () => void) => {
    suppressDispatchRef.current = true;
    try {
      callback();
    } finally {
      suppressDispatchRef.current = false;
    }
  }, []);

  const replaceDocument = useCallback(
    (view: EditorView, nextText: string) => {
      const currentDoc = view.state.doc.toString();
      if (currentDoc === nextText) {
        return;
      }

      const selection = view.state.selection.main;

      withSuppressedDispatch(() => {
        view.dispatch({
          changes: {
            from: 0,
            to: currentDoc.length,
            insert: nextText,
          },
          selection: {
            anchor: Math.min(selection.anchor, nextText.length),
            head: Math.min(selection.head, nextText.length),
          },
        });
      });
    },
    [withSuppressedDispatch],
  );

  const applyIncomingOperations = useCallback(
    (view: EditorView, pendingOps: RopeOperation[]) => {
      const shouldMapSelection = view.hasFocus;
      const selection = view.state.selection.main;
      let anchor = selection.anchor;
      let head = selection.head;

      const mapPosition = (pos: number, op: RopeOperation) => {
        if (op.type === "insert") {
          return op.pos <= pos ? pos + op.value.length : pos;
        }
        if (op.to <= pos) {
          return pos - (op.to - op.from);
        }
        if (op.from < pos) {
          return op.from;
        }
        return pos;
      };

      withSuppressedDispatch(() => {
        try {
          for (const op of pendingOps) {
            if (op.type === "insert") {
              const from = Math.max(0, Math.min(op.pos, view.state.doc.length));
              view.dispatch({
                changes: {
                  from,
                  insert: op.value,
                },
              });
            } else {
              const from = Math.max(0, Math.min(op.from, view.state.doc.length));
              const to = Math.max(from, Math.min(op.to, view.state.doc.length));
              view.dispatch({
                changes: {
                  from,
                  to,
                  insert: "",
                },
              });
            }
            if (shouldMapSelection) {
              anchor = mapPosition(anchor, op);
              head = mapPosition(head, op);
            }
          }

          if (shouldMapSelection) {
            const docLen = view.state.doc.length;
            view.dispatch({
              selection: {
                anchor: Math.max(0, Math.min(anchor, docLen)),
                head: Math.max(0, Math.min(head, docLen)),
              },
            });
          }
        } catch {
          const currentDoc = view.state.doc.toString();
          let fallbackDoc = currentDoc;
          for (const op of pendingOps) {
            fallbackDoc = applyOpToText(fallbackDoc, op);
          }
          view.dispatch({
            changes: {
              from: 0,
              to: currentDoc.length,
              insert: fallbackDoc,
            },
          });
          publishDocText(fallbackDoc);
          publishEvent("remote_fallback", fallbackDoc);
          return;
        }

        publishDocText(view.state.doc.toString());
        publishEvent("remote_apply", view.state.doc.toString());
      });
    },
    [applyOpToText, publishDocText, publishEvent, withSuppressedDispatch],
  );

  const createEditorExtensions = useCallback((): Extension[] => {
    return [
      editableCompartmentRef.current.of(EditorView.editable.of(isSynced)),
      editorThemeCompartmentRef.current.of(buildEditorTheme(editorSettings)),
      lineNumbers(),
      history(),
      drawSelection(),
      highlightActiveLine(),
      keymapCompartmentRef.current.of(
        buildEditorKeymap(editorSettings.tabSize),
      ),
      tabSizeCompartmentRef.current.of(
        EditorState.tabSize.of(editorSettings.tabSize),
      ),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged || suppressDispatchRef.current) {
          return;
        }

        let ops: RopeOperation[] = [];
        let delta = 0;
        update.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
          const pos = fromA + delta;
          const deletedLen = toA - fromA;
          const insertedText = inserted.toString();

          if (deletedLen > 0) {
            ops.push({
              event: "text_update",
              type: "delete",
              from: pos,
              to: pos + deletedLen,
              version: 0,
              author: 0,
            });
          }

          if (insertedText.length > 0) {
            ops.push({
              event: "text_update",
              type: "insert",
              pos,
              value: insertedText,
              version: 0,
              author: 0,
            });
          }

          delta += insertedText.length - deletedLen;
        });

        const startSelection = update.startState.selection.main;
        const previousDocLen = update.startState.doc.length;
        const isSuspiciousReplaceAll =
          startSelection.empty &&
          ops.length >= 1 &&
          ops.some(
            (op) =>
              op.type === "delete" &&
              op.from === 0 &&
              op.to === previousDocLen &&
              previousDocLen > 1,
          );

        if (isSuspiciousReplaceAll) {
          ops = buildOpsFromDiff(
            update.startState.doc.toString(),
            update.state.doc.toString(),
          );
        }

        if (ops.length > 0) {
          publishDocText(update.state.doc.toString());
          publishEvent("local_update", update.state.doc.toString());
          submitOpsRef.current(ops);
        }
      }),
    ];
  }, [
    buildOpsFromDiff,
    editorSettings,
    isSynced,
    publishDocText,
    publishEvent,
  ]);
  const initialExtensionsRef = useRef<Extension[] | null>(null);
  if (initialExtensionsRef.current === null) {
    initialExtensionsRef.current = createEditorExtensions();
  }

  useEffect(() => {
    submitOpsRef.current = setText;
  }, [setText]);

  useEffect(() => {
    if (!hostRef.current || viewRef.current) {
      return;
    }

    const initialSettings = initialSettingsRef.current;
    viewRef.current = new EditorView({
      state: EditorState.create({
        doc: initialDocRef.current,
        extensions: initialExtensionsRef.current ?? [],
      }),
      parent: hostRef.current,
    });

    const view = viewRef.current;
    view.contentDOM.setAttribute("id", id);
    view.contentDOM.setAttribute("spellcheck", "false");
    view.contentDOM.setAttribute("autocorrect", "off");
    view.contentDOM.setAttribute("autocapitalize", "off");
    view.contentDOM.setAttribute("data-gramm", "false");
    syncHostMetadata(initialSettings);
    publishDocText(view.state.doc.toString());
    publishEvent("mount", view.state.doc.toString());

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [id, publishDocText, publishEvent, syncHostMetadata]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const startIdx = Math.min(processedIncomingOps.current, incomingOp.length);
    const pendingOps = incomingOp.slice(startIdx);
    if (pendingOps.length === 0) {
      return;
    }
    processedIncomingOps.current = incomingOp.length;

    applyIncomingOperations(view, pendingOps);
  }, [applyIncomingOperations, incomingOp]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    replaceDocument(view, curText);
    processedIncomingOps.current = incomingOp.length;
    publishDocText(curText);
    publishEvent("snapshot_replace", curText);
  }, [
    curText,
    incomingOp.length,
    publishDocText,
    publishEvent,
    replaceDocument,
    syncVersion,
  ]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    view.dispatch({
      effects: [
        editableCompartmentRef.current.reconfigure(
          EditorView.editable.of(isSynced),
        ),
        editorThemeCompartmentRef.current.reconfigure(
          buildEditorTheme(editorSettings),
        ),
        tabSizeCompartmentRef.current.reconfigure(
          EditorState.tabSize.of(editorSettings.tabSize),
        ),
        keymapCompartmentRef.current.reconfigure(
          buildEditorKeymap(editorSettings.tabSize),
        ),
      ],
    });

    syncHostMetadata(editorSettings);
  }, [editorSettings, isSynced, syncHostMetadata]);

  return (
    <div className="flex h-full min-h-0 flex-row overflow-hidden rounded border-2 border-[#213030] md:rounded-r-none">
      <div ref={hostRef} className="h-full w-full" />
    </div>
  );
}

export default Textbox;
