# Architecture

Kaoyan Math Bank is a local-first React, Express, and Electron app. The browser UI talks to the local API through same-origin requests in packaged desktop builds and through the Vite proxy in development.

## Data Flow

```text
React UI
  -> src/api/client.ts
  -> Express API in server/index.ts
  -> workspace files: bank.json, assets/, exports/, .tmp/
```

The shared API and data contracts live in `shared/`. Frontend and backend modules should import those types instead of maintaining separate copies.

## Frontend Boundaries

- `src/App.tsx` is only the composition root.
- `src/hooks/useQuestionBankApp.ts` owns workspace state, derived lists, persistence, selection, compile, and export actions.
- `src/components/` contains focused view components for setup, sidebar, workspace, module editors, preview, and overlays.
- CodeMirror is isolated in `src/components/LatexEditor.tsx` and lazy-loaded by `ModuleEditor`, keeping the initial Vite bundle smaller.
- `src/api/client.ts` is the only place that should call `fetch` for app API routes.

## Backend Boundaries

- `server/index.ts` owns HTTP routing, request validation, origin checks, upload handling, and response status codes.
- `server/storage.ts` owns app state, workspace lifecycle, bank normalization, atomic JSON writes, and shell path allowlist helpers.
- `server/latex.ts` owns export ordering, LaTeX document generation, asset copying, TeX detection, and compilation.

## Data Safety

`bank.json` and `app-state.json` are written through temp-file rename. When replacing an existing file, the previous version is kept as `<file>.bak`. The workspace schema remains `version: 1`.

## Desktop Boundary

Electron exposes only three preload capabilities: selecting a workspace directory, opening a known workspace path, and moving a known workspace path to Trash/Recycle Bin. Main-process IPC rejects paths that are not the current or recent workspace root.
