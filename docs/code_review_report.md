# Code Review Report

Date: 2026-03-10

## Executive Summary

I did a focused maintainability/extensibility review over the current workspace, editor sync, dashboard, and terminal paths, with a second pass specifically checking for relics and dead code after the first audit.

Main conclusion:

- The biggest risks are not unused files, but large multi-responsibility modules that now own too much product logic.
- The old quick-editor path is still live and should not be removed: the classic `/` route still uses `Toolbar`, `OutputToolbar`, `outputBox`, `LanguageSelector`, and the `output_update` path.
- There are a few small dead/redundant spots, but the larger issue is architectural bloat and stale-hook/state patterns.

## Top Refactor Priorities

### 1. `Dashboard.tsx` is carrying too many responsibilities

File: `real-time-app/src/components/Dashboard.tsx`

Why it needs refactoring:

- The file is 1420 lines long and mixes:
  - dashboard page layout
  - notes persistence and migration
  - folder/note data normalization
  - drag/drop behavior
  - modal/composer state
  - sorting rules
  - recursive tree rendering
- This makes even small note-feature changes high risk because data rules and rendering rules are tightly interleaved.

High-risk spots:

- Notes migration/normalization logic is embedded in the page component area instead of a dedicated store module: `Dashboard.tsx:207-416`
- Folder/note move logic is mixed into the same file as rendering: `Dashboard.tsx:458-547`
- Recursive tree rendering and drag/drop rules live inline in the component: `Dashboard.tsx:846-1076`
- Page layout and notes UI are combined in one component body: `Dashboard.tsx:1078-1400`

Refactor direction:

- Extract a `notesStore.ts` or `useWorkspaceNotes.ts` for persistence, migration, and move/sort rules.
- Extract note tree row components (`NoteRow`, `FolderNode`, `NotesPanel`).
- Keep `Dashboard.tsx` mostly as composition/layout.

### 2. Terminal backend is a single monolith with transport, session lifecycle, and shell process control fused together

File: `backend/terminal-handling/terminalHandler.go`

Why it needs refactoring:

- The file is 639 lines and currently owns:
  - websocket transport
  - room/client tracking
  - private/shared session routing
  - PTY creation
  - shell/environment setup
  - session state mutation
  - broadcast logic
- Shared/private behavior is duplicated across create/output/draft/close flows, which will get harder to extend if features like permissions, persistence, or multiple shell types are added.

High-risk spots:

- Websocket dispatch and room mutation all happen inside one switch: `terminalHandler.go:176-249`
- Session/process creation and shell environment policy are embedded in the same file: `terminalHandler.go:252-348`
- Broadcast methods repeat scope branching across output/draft/close: `terminalHandler.go:495-619`

Refactor direction:

- Split into at least:
  - transport/controller layer
  - room/session manager
  - PTY/session process wrapper
- Introduce a typed event layer instead of raw `map[string]any` payload construction everywhere.
- Unify the shared/private fanout rules behind one routing helper.

### 3. `useRopes.tsx` still relies on a mutable singleton and suppressed hook semantics

File: `real-time-app/src/hooks/useRopes.tsx`

Why it needs refactoring:

- `sharedEditorState` is a module-level mutable singleton: `useRopes.tsx:115-131`
- That creates hidden coupling between mounts and makes future multi-editor or multi-document support harder.
- The hook has real stale-dependency warnings from lint, which is a maintainability signal rather than cosmetic noise.

High-risk spots:

- Shared singleton state: `useRopes.tsx:115-131`
- `submitLocalOps` callback depends on local functions not listed in the dependency array: `useRopes.tsx:234-248`
- Main websocket subscription effect also depends on internal helpers not included in the array: `useRopes.tsx:250-377`
- `outputText` is still bundled into the same shared editor hook even though workspace terminal state is now separate: `useRopes.tsx:117`, `useRopes.tsx:150`, `useRopes.tsx:331-333`

Refactor direction:

- Split editor sync state from legacy run/output state.
- Replace module-level mutable state with an explicit provider/store if shared persistence across mounts is still desired.
- Resolve the hook dependency warnings instead of relying on closure stability by convention.

### 4. Workspace terminal frontend is split across two large files with fragile UI parsing and protocol knowledge in the view layer

Files:

- `real-time-app/src/pages/WorkspaceCode.tsx`
- `real-time-app/src/hooks/useWorkspaceTerminal.ts`

Why it needs refactoring:

- `WorkspaceCode.tsx` is already 486 lines and owns:
  - layout
  - prompt parsing
  - resize math
  - focus behavior
  - terminal header responsiveness
  - inline terminal rendering
- `useWorkspaceTerminal.ts` owns websocket wiring, normalization, sanitization, tab state, draft sync, and resize/send behavior in one hook.
- Prompt parsing is UI-driven string manipulation instead of a terminal model, which is brittle long term.

High-risk spots:

- Prompt/history reconstruction is string-hack based: `WorkspaceCode.tsx:51-76`
- Resize logic is coupled directly to DOM measurement and event listeners: `WorkspaceCode.tsx:126-199`
- Terminal hook mixes transport, state normalization, and draft sync policy: `useWorkspaceTerminal.ts:94-387`
- Sanitization regexes currently trip lint and will be easy to regress: `useWorkspaceTerminal.ts:57-64`

Refactor direction:

- Extract a `TerminalPane` / `TerminalHeader` / `TerminalOutput` component set.
- Move prompt/history shaping into a small tested utility module.
- Split websocket protocol handling from tab-state reducers.
- Add explicit typed helpers for `terminal_snapshot`, `terminal_output`, `terminal_draft`, etc.

### 5. `textbox.tsx` has hidden complexity and stale-effect warnings around editor integration

File: `real-time-app/src/components/textbox.tsx`

Why it needs refactoring:

- This is a critical integration file between React and CodeMirror, and lint is already flagging missing hook dependencies in multiple places.
- Those warnings are especially important in editor integration code because stale closures become hard-to-debug selection/document bugs.

Concrete issues from lint:

- Missing dependencies around editor update effects: `textbox.tsx:343`, `textbox.tsx:435`, `textbox.tsx:469`

Refactor direction:

- Isolate CodeMirror setup/update logic into smaller dedicated hooks.
- Make `publishEvent` and similar helpers stable or move them outside the component where appropriate.
- Reduce broad effects that depend on many mutable values.

### 6. Workspace layout and terminal state are beginning to duplicate responsive/layout policy

Files:

- `real-time-app/src/pages/Workspace.tsx`
- `real-time-app/src/pages/WorkspaceCode.tsx`

Why it needs refactoring:

- Sidebar resizing/collapse logic lives in one page while terminal resizing/collapse logic lives in another, each with custom pointer handling and persisted-in-state sizing behavior.
- This is not dead code, but it is the same class of behavior implemented twice with separate assumptions.

High-risk spots:

- Sidebar drag behavior: `Workspace.tsx:38-58`
- Terminal drag behavior: `WorkspaceCode.tsx:160-199`

Refactor direction:

- Introduce a shared resizable-panel abstraction or utility hook before a third dockable/resizable surface appears.

## Smaller Relics / Cleanup Candidates

These are not the primary risk, but they are legitimate cleanup candidates.

### 1. Unused parameter in recursive notes rendering

File: `real-time-app/src/components/Dashboard.tsx`

- `depth` is passed recursively but not used in rendering anymore: `Dashboard.tsx:938`, `Dashboard.tsx:1063`

### 2. Redundant helper implementation

File: `real-time-app/src/hooks/useRopes.tsx`

- `cloneOp` has a ternary that returns the same thing on both branches: `useRopes.tsx:22-24`

### 3. Terminal status is now weakly defined on the frontend

Files:

- `real-time-app/src/hooks/useWorkspaceTerminal.ts`
- `real-time-app/src/pages/WorkspaceCode.tsx`

- `status` is still tracked and updated, but it no longer clearly drives a user-facing model beyond internal transitions.
- This is not dead yet, but it is becoming ambiguous and should either become meaningful UI state or be reduced.

Relevant spots:

- `useWorkspaceTerminal.ts:202-224`
- `useWorkspaceTerminal.ts:354-361`

## Lint / Quality Debt Worth Addressing

These are not all blockers, but they are strong indicators of maintainability debt.

### Hook dependency warnings

- `real-time-app/src/components/Dashboard.tsx:645`
- `real-time-app/src/components/textbox.tsx:343`
- `real-time-app/src/components/textbox.tsx:435`
- `real-time-app/src/components/textbox.tsx:469`
- `real-time-app/src/hooks/useRopes.tsx:248`
- `real-time-app/src/hooks/useRopes.tsx:377`
- `real-time-app/src/pages/WorkspaceCode.tsx:117`
- `real-time-app/src/pages/WorkspaceCode.tsx:124`

### Terminal hook lint errors

- `real-time-app/src/hooks/useWorkspaceTerminal.ts:59-62`
  - control-character regexes trigger `no-control-regex`
  - this should be rewritten into safer escape-sequence sanitization helpers

### Example test debt

- `real-time-app/tests-examples/demo-todo-app.spec.ts:429`
- `real-time-app/tests-examples/demo-todo-app.spec.ts:435`
  - `any` usage in example tests is currently failing lint

### Fast-refresh structure warnings

- `real-time-app/src/components/ui/button.tsx:59`
- `real-time-app/src/hooks/WebSocketContext.tsx:94`

## Dead Path / Obsolete Path Conclusions

After a second pass, I do **not** recommend removing these yet:

- `Toolbar.tsx`
- `OutputToolbar.tsx`
- `outputBox.tsx`
- `LanguageSelector.tsx`
- backend `run_code` / `code_review` path
- `output_update` handling in the root quick editor path

Reason:

- They are still actively used by the root `/` quick editor flow via `real-time-app/src/pages/Code.tsx`.
- Removing them now would break the split between the simple root experience and the advanced `/workspace` experience.

## Recommended Refactor Order

1. Extract the notes domain logic out of `Dashboard.tsx`
2. Split `terminalHandler.go` into transport/session/process layers
3. Untangle `useRopes.tsx` shared singleton state and fix hook dependency issues
4. Break `WorkspaceCode.tsx` + `useWorkspaceTerminal.ts` into smaller terminal UI/state modules
5. Clean up `textbox.tsx` effect structure
6. Remove the small relics and resolve lint debt once the larger ownership boundaries are clearer
