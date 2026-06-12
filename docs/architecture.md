# Architecture

Kaoyan Math Bank is a local-first React, Express, and Electron app. The browser UI talks to the local API through same-origin requests in packaged desktop builds and through the Vite proxy in development.

## Data Flow

```text
React UI
  -> src/api/client.ts
  -> Express API in server/index.ts
  -> domain services and storage modules
  -> workspace files: bank.json, assets/, exports/, .tmp/, .history/
```

The shared API and data contracts live in `shared/`. Frontend and backend modules should import those types instead of maintaining separate copies.

## Frontend Boundaries

- `src/App.tsx` is only the composition root.
- `src/hooks/useQuestionBankApp.ts` is the facade that composes focused hooks for workspace state, derived lists, persistence, selection, reordering, compile, and export actions.
- `src/hooks/useAutosave.ts` owns the single-flight, coalescing save queue and its `flush()` boundary.
- `src/components/` contains focused view components for setup, sidebar, workspace, module editors, preview, and overlays.
- CodeMirror is isolated in `src/components/LatexEditor.tsx` and lazy-loaded by `ModuleEditor`, keeping the initial Vite bundle smaller.
- `src/api/client.ts` is the only place that should call `fetch` for app API routes.

## Backend Boundaries

- `server/index.ts` owns HTTP routing, request validation, origin checks, and response status codes.
- `server/app-state.ts` owns pure app-state reads and serialized app-state updates.
- `server/bank-schema.ts` owns v1/v2 normalization and default/sample bank creation.
- `server/json-file.ts` owns atomic JSON writes and immediate `.bak` files.
- `server/storage.ts` owns workspace lifecycle, revision-checked bank saves, history snapshots, recovery, and shell path allowlist helpers.
- `server/asset-service.ts` validates image extension, MIME, and signature before generating a safe server-side filename.
- `server/export-service.ts` stages and compiles exports before atomically replacing the final directory.
- `server/latex.ts` owns export ordering, LaTeX document generation, asset copying, TeX detection, and compilation.

## Data Safety

`bank.json` and `app-state.json` are written through temp-file rename. When replacing an existing file, the previous version is kept as `<file>.bak`. Each bank response includes a content-hash revision; saves carry that revision and are rejected with `BANK_CONFLICT` when the disk file changed. Save requests are serialized per workspace, and the renderer keeps at most one request in flight while coalescing newer edits.

The first bank modification in an application session also records a validated snapshot under `.history/`, retaining the newest ten snapshots. Recovery accepts only candidate IDs enumerated by the server and never accepts an arbitrary path.

The workspace schema is `version: 2`; version 1 banks are normalized into version 2 on read, and the explicit `npm run migrate:v2 -- <workspace>` command can rewrite an older workspace with a backup.

In schema version 2, each question stores its three editable LaTeX snippets under `modules.question.tex`, `modules.solution.tex`, and `modules.note.tex`. This keeps module rendering, upload insertion, validation, compile, and export paths on one shared shape instead of parallel `questionTex`, `solutionTex`, and `noteTex` fields.

## Desktop Boundary

Electron exposes only narrow preload capabilities for selecting a directory, opening/trashing a known workspace path, opening trusted URLs, and registering the close-time flush callback. It does not expose `ipcRenderer`.

Every IPC entry validates its sender. Main-window navigation is locked to the application origin, new Electron windows are denied, and trusted HTTPS or local PDF links are delegated to the system browser. App quit and window close both wait for the renderer save queue; failures offer either returning to edit or explicitly discarding unsaved changes.

Packaged pages receive a strict CSP. Development additionally allows Vite's inline React Refresh bootstrap, local HMR, and local API connections. The macOS development runtime uses an isolated Chromium session and mock keychain so it does not contend with or request credentials for an installed build; packaged builds continue to use the system keychain.
