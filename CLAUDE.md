# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is

Avtonetbot is an Electron desktop app that automates renewing classified car listings on avto.net (a Slovenian car-sales site) for licensed brokers. Each "renewal" deletes an existing ad and recreates it with slightly tweaked values so it surfaces as new in search. The repo is built on top of electron-react-boilerplate (ERB); much of `.erb/`, `tsconfig.json`, and the webpack pipeline is unmodified boilerplate.

UI strings are in Slovenian — don't translate them unless asked.

## Commands

- `npm start` — dev mode. Boots the renderer dev-server on :1212, then spawns the preload watcher and the electron main process (see `webpack.config.renderer.dev.ts` → `setupMiddlewares`). Hot reload works for renderer; `electronmon` restarts main on `src/main/**` changes.
- `npm run build` — production webpack build of main + renderer.
- `npm run package` — full electron-builder pipeline (`win` target by default in the script; `mac`/`linux` targets defined in `package.json#build`). Publishes to GitHub releases `galjeza/anbot` when `--publish always`.
- `npm test` — runs Jest (jsdom env). Only one test exists today (`src/__tests__/App.test.tsx` smoke renders the app).
- `npm run lint` — eslint over `.js,.jsx,.ts,.tsx`.

`build:webextension` / `typecheck:webextension` in `package.json` are **stale** — they point at `webextension/tsconfig.json`, but that directory was removed in commit `72ccb8a`. The Chrome-extension rewrite was abandoned and reverted to the Electron+Puppeteer flow. Don't run those scripts and don't assume a webextension exists.

## Two-package layout (ERB convention)

There are two `package.json` files. This trips people up.

- `./package.json` — dev tooling + most runtime deps. Used by webpack and the renderer.
- `./release/app/package.json` — only what gets bundled into the packaged Electron app. Currently puppeteer + its `puppeteer-extra-*` plugins. `webpack.config.base.ts` reads this file's `dependencies` and marks them as **externals** (i.e., not bundled into the webpack output; loaded from `node_modules` at runtime).

When adding a runtime dep that the packaged app needs (anything `require`d from `src/main/**` or `src/scraper/**`), add it to **both** files. If it's only used at build time or only in the renderer bundle, top-level only.

## Architecture

Three layers connected by Electron IPC:

```
renderer (React)  ──ipc──►  main (Electron)  ──direct call──►  scraper (Puppeteer + Steel)
       ▲                          │
       └── electron-store ────────┘
```

### Main process (`src/main/`)
`main.ts` is the entry — registers IPC handlers and creates the BrowserWindow. The exposed IPC surface (see `preload.ts` for the renderer-side wrapper, mounted on `window.electron`):

| Channel | Direction | Purpose |
|---|---|---|
| `get-ads` (handle) | renderer → main | Calls `fetchActiveAds(brokerId, adType)`; brokerId is pulled from electron-store's `userData`. |
| `renew-ads` (handle) | renderer → main | Iterates the selected ads and calls `renewAd` for each, sleeping `pause` minutes between (see `handleRenewAds`). |
| `check-update-status` (handle) | renderer → main | Returns `updateAvailable` flag from `updater.ts`. |
| `electron-store-get` / `electron-store-set` (sync) | renderer ↔ main | Persistent store. The only key in use is `userData` (`email`, `password`, `chromePath`, `brokerId`, `subscriptionPaidTo`, `hdImages`). |
| `dev-trigger-update` (handle) | renderer → main | Dev-only fake update-available emit (gated by `NODE_ENV === 'development'`). |

`updater.ts` wraps `electron-updater` with Slovenian dialogs. Auto-update flow: app boot constructs `AppUpdater` → `checkForUpdatesAndNotify` → handler shows a confirm dialog → manual download → install on quit.

### Renderer (`src/renderer/`)
React 18 + `react-router-dom` (using `MemoryRouter`, not browser history). Four pages under `src/renderer/pages/`:

- `Menu` — home. Fetches user metadata from `https://avtonet-server.onrender.com/user?email=…` (subscription, brokerId, hdImages flag) and writes it back into the local store. Renewal links are disabled if subscription expired **or** an update is available.
- `UpdateUser` — email/password/chromePath form. Note: `chromePath` is no longer used since the scraper switched to Steel cloud browsers; leave the field for now but treat the value as ignored.
- `Adlist` — invokes `get-ads`, lets the user pick which to renew + a pause-in-minutes value.
- `Obnavljanje` — fires `renew-ads` and waits. Re-checks `check-update-status` before starting and bails if an update is pending.

Tailwind is loaded via CDN inside `src/renderer/index.ejs` (`<script src="https://cdn.tailwindcss.com">`). There is **no local Tailwind / PostCSS config**. The CSP in that same file allowlists the CDN — if you switch to a local Tailwind install, update the CSP too.

### Scraper (`src/scraper/`)
Mixed `.ts` and `.js`. The `.js` files import each other with explicit `.js` extensions (e.g., `from './utils/utils.js'`) — **keep the extensions**, removing them breaks ts-loader's module resolution in this configuration.

Two top-level entry points called from `main.ts`:

- `get-active-ads.ts` → `fetchActiveAds(brokerId, adType)`: opens the broker's public listing URL (one of three in `utils/constants.ts#AVTONET_URLS`, keyed by `adType: 'car' | 'dostavna' | 'platisca'`), paginates via `.GO-Rounded-R`, extracts `name/price/photoUrl/adUrl/adId` per `.GO-Results-Row`. Skips rows priced as `'PRODANO'` (sold).
- `renew-ad.js` → `renewAd(adId, email, password, hdImages, adType)`: orchestrates `loginToAvtonet` → `getCarData` (scrapes the edit form into a flat `[{name, value}, …]` array) → `deleteOldAd` → `createNewAd` (creates a fresh ad with the scraped values) → `uploadImages` (re-uploads the cached images). Wraps everything in try/finally so the Steel session always releases.

#### Browser sessions are remote
`utils/browser-utils.js#setupBrowser` does **not** launch a local Chrome. It creates a Steel.dev cloud browser session (`useProxy: true, solveCaptcha: true`) and connects puppeteer-core via `wss://connect.steel.dev`. Returned `release()` disconnects puppeteer **and** releases the Steel session — always call it (the existing code uses `try/finally`).

The Steel API key is currently hardcoded as a fallback in `browser-utils.js` with `STEEL_API_KEY` env-var override. If you rotate it, also update the fallback (or remove the fallback and require the env var).

#### Image caching and hash compatibility
`utils/utils.js#getAdImagesDirectory` checks **four** possible hash schemes (`simple`, `legacyV3`, `legacyV2`, `legacyV1`) under `<userData>/AdImages/<hash>/` in that priority order. This is intentional backwards compat for users who have cached image folders from older app versions. **Don't delete or "simplify"** the legacy hash functions without a migration plan — they prevent unnecessary re-downloads on existing installs.

For non-HD ads, downloaded images are run through Jimp (`reduceSharpnessDesaturateAndBlurEdges`) to slightly alter them. This and the random price offset (`getCarData#randomPriceOffset`) / random registration year (`randomRegistrationYear`) exist to evade Avtonet's duplicate detection. Don't remove these without checking with the user.

#### Captcha
`renew-ad/solve-captcha.js` handles a math-problem CAPTCHA: parses two numbers from a `<p>` inside the second-to-last `<table>`, types the sum into `input[name="ReadTotal"]` with human-like per-digit delays. Steel sessions also have `solveCaptcha: true` enabled at the platform layer for Turnstile-style challenges.

#### Image upload via Steel session files
`renew-ad/upload-images.js` doesn't pass local paths to `puppeteer`'s `uploadFile` directly — it first uploads each local file to the Steel session via `steelClient.sessions.files.upload(sessionId, …)`, then hands the returned session-side path to puppeteer. The `sessionId` is threaded down from `setupBrowser` through `renewAd`. If you add a new flow that uploads files, follow this two-step pattern.

#### Ad-type quirks
- `car`: full brand/model/oblika/fuel/registration flow.
- `dostavna` (delivery vans): brand/model fall back to `znamkaTEMP` / `modelTEMP` fields when the regular names aren't present (see `select-brand-and-model.js`).
- `platisca` (wheel rims): skips the entire brand/model/registration step in `createNewAd`; uses a different new-ad URL and a different hash key-set in `generateAdHash*`.

## Build / packaging gotchas

- `build:dll` (run by `postinstall`) builds the dev DLL — if the renderer dev-server complains "DLL missing", run `npm run postinstall`.
- `electron-builder` bundles `node_modules/puppeteer/.local-chromium/**` as an extra resource (`package.json#build.extraResources`). Even though the runtime uses `puppeteer-core` against Steel, removing this would break any code path that still expects bundled Chromium.
- Auto-update publishes to `github:galjeza/anbot`. Bumping the runtime version means editing `release/app/package.json#version`, not the top-level one.
