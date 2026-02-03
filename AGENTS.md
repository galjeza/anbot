# AGENTS

This repo is an Electron + React desktop app with a Puppeteer-based scraper.
Use this file as a quick guide for automated changes and code review.
If anything here conflicts with config files, the config wins.

## Project layout

- `src/main`: Electron main process (app lifecycle, IPC, auto updates).
- `src/main/preload.ts`: contextBridge API for the renderer.
- `src/renderer`: React UI, routes, and pages.
- `src/scraper`: Puppeteer automation and scraping helpers.
- `.erb`: Electron React Boilerplate build config and scripts.
- `release/app`: packaged app deps; avoid editing unless required.

## Runtime notes

- Node/Electron app; engines: Node >=14, npm >=7 (see `package.json`).
- TypeScript is strict; JavaScript is allowed (`allowJs`).
- Renderer uses React Router and jsdom tests.

## Commands (npm)

Install (runs build:dll via postinstall):

```bash
npm install
```

Development:

```bash
npm start              # starts renderer dev server
npm run start:main     # run in another terminal for Electron main
npm run start:preload  # when editing preload
```

Build:

```bash
npm run build          # build main + renderer
npm run build:main
npm run build:renderer
npm run build:dll      # rebuild dev DLL if needed
```

Packaging:

```bash
npm run package        # electron-builder (local platform)
npm run rebuild        # rebuild native modules for release/app
```

Lint:

```bash
npm run lint
```

Tests (Jest):

```bash
npm test
```

Single test examples:

```bash
npm test -- --runTestsByPath src/__tests__/App.test.tsx
npm test -- -t "should render"
```

Test prereq: Jest runs `.erb/scripts/check-build-exists.ts`,
so ensure `npm run build:main` and `npm run build:renderer`
have been run at least once before testing.

## Config references

- `package.json` defines scripts, Prettier singleQuote, and Jest config.
- `.eslintrc.js` extends `erb` and enables TypeScript linting.
- `tsconfig.json` sets strict mode, es2022, commonjs, and allowJs.
- `.editorconfig` defines 2-space indent and final newline.
- `.erb/configs` contains webpack targets and path resolution.

## Data and storage

- User settings are persisted with `electron-store` (see `window.electron.store`).
- Store key: `userData` with email/password/chromePath and subscription info.
- Avoid writing credentials to files; use the store API.

## Code style and conventions

Formatting

- Use 2-space indent and final newline (see `.editorconfig`).
- Use single quotes (Prettier config in `package.json`).
- Keep semicolons; align with existing files.

Imports

- Prefer ES module imports; use `require` only for conditional/optional modules.
- Order: Node builtins, external packages, then local relative imports.
- Do not add file extensions in import paths.

TypeScript and types

- `tsconfig.json` is `strict: true`; avoid `any` unless bridging untyped APIs.
- Prefer `unknown` + type guards over `any`.
- If you add/modify IPC APIs, update types in `src/renderer/preload.d.ts`.
- `allowJs` is enabled; keep scraper JS files as JS unless a refactor is needed.

Naming

- React components use PascalCase; default export from the file.
- Variables/functions use camelCase; constants use UPPER_SNAKE_CASE.
- File names follow folder norms (renderer pages use PascalCase-ish names).
- Scraper subfolders use kebab-case (e.g., `renew-ad`).

React/renderer

- Use hooks for state/effects; avoid side effects outside `useEffect`.
- Prefer `ipcRenderer.invoke` calls via the preload bridge (no direct Node APIs).
- User-facing strings are currently Slovene; keep language consistent.

Electron/IPC

- Add new IPC handlers in `src/main/main.ts` with `ipcMain.handle`.
- Expose only the minimal API via `contextBridge` in `src/main/preload.ts`.
- Keep IPC payloads serializable and versioned if you change shape.

Scraper (Puppeteer)

- Use `setupBrowser` from `src/scraper/utils/browser-utils.js`.
- Prefer `async/await` and `for...of` for sequential steps.
- Close browsers in `finally` blocks when adding new flows.
- Reuse helpers in `src/scraper/utils` for waits and data transforms.

Error handling and logging

- Do not swallow errors silently; log and/or surface user-friendly messages.
- Renderer: set error UI state instead of throwing.
- Main process: use `dialog.showErrorBox` or `electron-log` where appropriate.
- Scraper: catch per-item failures and continue, but log context.

Testing

- Tests live under `src/__tests__` and use `@testing-library/react`.
- Keep tests fast and deterministic; mock IPC when needed.
- Jest environment is `jsdom`; avoid Node-only APIs in renderer tests.

Formatting and linting notes

- ESLint extends `erb` with TypeScript rules; prefer its defaults.
- If you format manually, match existing style; no mass reformatting.

## Editor/assistant rules

- No Cursor rules found in `.cursor/rules` or `.cursorrules`.
- No Copilot instructions found in `.github/copilot-instructions.md`.

## Adding new files

- Prefer TypeScript in `src/main` and `src/renderer`.
- Add new scraper modules next to existing `renew-ad` helpers.
- Update imports and IPC types if you add new entry points.

## Housekeeping

- Avoid editing `release/app` unless packaging requires it.
- Keep secrets out of the repo; use Electron store for user data.
- Use existing build scripts instead of custom ad-hoc bundling.

## Quick checklist

- Did you run `npm run lint`?
- If tests were touched, did you run `npm test` (after build:main/renderer)?
- If IPC changed, did you update preload and its types?
- If scraper changed, did you ensure the browser closes on error?
- If UI text changed, is language still consistent?
