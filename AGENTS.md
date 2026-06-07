# AGENTS.md

Guidance for coding agents (Claude Code, Cursor, Aider, Codex, etc.) working
on this repository. Mirrors `CLAUDE.md` and adds the `chrome-extension/`
subproject.

## What this app is

Avtonetbot automates renewing classified car listings on avto.net (a Slovenian
car-sales site) for licensed brokers. Each "renewal" deletes an existing ad
and recreates it with slightly tweaked values so it surfaces as new in search.

UI strings are in Slovenian — don't translate them unless asked.

The repo now contains **two parallel implementations** of the same feature:

1. **`src/` — the Electron desktop app** (the original). Built on
   electron-react-boilerplate; uses Puppeteer against Steel.dev cloud
   browsers. Distributed as a packaged binary via electron-builder + GitHub
   releases (`galjeza/anbot`).
2. **`chrome-extension/` — the Chrome MV3 extension** (added 2026-06). Same
   behavior, but the work happens inside a real Chrome tab the user can see —
   no Steel, no Puppeteer, no password storage.

They share no code. Don't run both at the same time — they'll fight for the
same avto.net session.

---

## Part 1 — Electron app (`src/`, `release/`, `.erb/`, etc.)

### Commands

- `npm start` — dev mode. Boots the renderer dev-server on :1212, then spawns
  the preload watcher and the electron main process (see
  `webpack.config.renderer.dev.ts` → `setupMiddlewares`). Hot reload works for
  renderer; `electronmon` restarts main on `src/main/**` changes.
- `npm run build` — production webpack build of main + renderer.
- `npm run package` — full electron-builder pipeline (`win` target by default
  in the script; `mac`/`linux` targets defined in `package.json#build`).
  Publishes to GitHub releases `galjeza/anbot` when `--publish always`.
- `npm test` — runs Jest (jsdom env). Only one test exists today
  (`src/__tests__/App.test.tsx` smoke renders the app).
- `npm run lint` — eslint over `.js,.jsx,.ts,.tsx`.

`build:webextension` / `typecheck:webextension` in `package.json` are
**stale** — they point at `webextension/tsconfig.json`, but that directory
was removed in commit `72ccb8a`. The Chrome-extension rewrite at that point
was abandoned and reverted to the Electron+Puppeteer flow. Don't run those
scripts and don't assume a `webextension/` directory exists. The current
Chrome extension lives in `chrome-extension/` (see Part 2 below) and has its
own toolchain (none — vanilla JS, no build step).

### Two-package layout (ERB convention)

There are two `package.json` files. This trips people up.

- `./package.json` — dev tooling + most runtime deps. Used by webpack and the
  renderer.
- `./release/app/package.json` — only what gets bundled into the packaged
  Electron app. Currently puppeteer + its `puppeteer-extra-*` plugins.
  `webpack.config.base.ts` reads this file's `dependencies` and marks them as
  **externals** (i.e., not bundled into the webpack output; loaded from
  `node_modules` at runtime).

When adding a runtime dep that the packaged app needs (anything `require`d
from `src/main/**` or `src/scraper/**`), add it to **both** files. If it's
only used at build time or only in the renderer bundle, top-level only.

### Architecture

Three layers connected by Electron IPC:

```
renderer (React)  ──ipc──►  main (Electron)  ──direct call──►  scraper (Puppeteer + Steel)
       ▲                          │
       └── electron-store ────────┘
```

#### Main process (`src/main/`)

`main.ts` is the entry — registers IPC handlers and creates the BrowserWindow.
The exposed IPC surface (see `preload.ts` for the renderer-side wrapper,
mounted on `window.electron`):

| Channel | Direction | Purpose |
|---|---|---|
| `get-ads` (handle) | renderer → main | Calls `fetchActiveAds(brokerId, adType)`; brokerId is pulled from electron-store's `userData`. |
| `renew-ads` (handle) | renderer → main | Iterates the selected ads and calls `renewAd` for each, sleeping `pause` minutes between (see `handleRenewAds`). |
| `check-update-status` (handle) | renderer → main | Returns `updateAvailable` flag from `updater.ts`. |
| `electron-store-get` / `electron-store-set` (sync) | renderer ↔ main | Persistent store. The only key in use is `userData` (`email`, `password`, `chromePath`, `brokerId`, `subscriptionPaidTo`, `hdImages`). |
| `dev-trigger-update` (handle) | renderer → main | Dev-only fake update-available emit (gated by `NODE_ENV === 'development'`). |

`updater.ts` wraps `electron-updater` with Slovenian dialogs. Auto-update
flow: app boot constructs `AppUpdater` → `checkForUpdatesAndNotify` → handler
shows a confirm dialog → manual download → install on quit.

#### Renderer (`src/renderer/`)

React 18 + `react-router-dom` (using `MemoryRouter`, not browser history).
Four pages under `src/renderer/pages/`:

- `Menu` — home. Fetches user metadata from
  `https://avtonet-server.onrender.com/user?email=…` (subscription, brokerId,
  hdImages flag) and writes it back into the local store. Renewal links are
  disabled if subscription expired **or** an update is available.
- `UpdateUser` — email/password/chromePath form. Note: `chromePath` is no
  longer used since the scraper switched to Steel cloud browsers; leave the
  field for now but treat the value as ignored.
- `Adlist` — invokes `get-ads`, lets the user pick which to renew + a
  pause-in-minutes value.
- `Obnavljanje` — fires `renew-ads` and waits. Re-checks
  `check-update-status` before starting and bails if an update is pending.

Tailwind is loaded via CDN inside `src/renderer/index.ejs`
(`<script src="https://cdn.tailwindcss.com">`). There is **no local Tailwind /
PostCSS config**. The CSP in that same file allowlists the CDN — if you
switch to a local Tailwind install, update the CSP too.

#### Scraper (`src/scraper/`)

Mixed `.ts` and `.js`. The `.js` files import each other with explicit `.js`
extensions (e.g., `from './utils/utils.js'`) — **keep the extensions**,
removing them breaks ts-loader's module resolution in this configuration.

Two top-level entry points called from `main.ts`:

- `get-active-ads.ts` → `fetchActiveAds(brokerId, adType)`: opens the
  broker's public listing URL (one of three in
  `utils/constants.ts#AVTONET_URLS`, keyed by
  `adType: 'car' | 'dostavna' | 'platisca'`), paginates via `.GO-Rounded-R`,
  extracts `name/price/photoUrl/adUrl/adId` per `.GO-Results-Row`. Skips rows
  priced as `'PRODANO'` (sold).
- `renew-ad.js` → `renewAd(adId, email, password, hdImages, adType)`:
  orchestrates `loginToAvtonet` → `getCarData` (scrapes the edit form into a
  flat `[{name, value}, …]` array) → `deleteOldAd` → `createNewAd` (creates a
  fresh ad with the scraped values) → `uploadImages` (re-uploads the cached
  images). Wraps everything in try/finally so the Steel session always
  releases.

##### Browser sessions are remote

`utils/browser-utils.js#setupBrowser` does **not** launch a local Chrome. It
creates a Steel.dev cloud browser session (`useProxy: true,
solveCaptcha: true`) and connects puppeteer-core via `wss://connect.steel.dev`.
Returned `release()` disconnects puppeteer **and** releases the Steel session
— always call it (the existing code uses `try/finally`).

The Steel API key is currently hardcoded as a fallback in `browser-utils.js`
with `STEEL_API_KEY` env-var override. If you rotate it, also update the
fallback (or remove the fallback and require the env var).

##### Image caching and hash compatibility

`utils/utils.js#getAdImagesDirectory` checks **four** possible hash schemes
(`simple`, `legacyV3`, `legacyV2`, `legacyV1`) under
`<userData>/AdImages/<hash>/` in that priority order. This is intentional
backwards compat for users who have cached image folders from older app
versions. **Don't delete or "simplify"** the legacy hash functions without a
migration plan — they prevent unnecessary re-downloads on existing installs.

For non-HD ads, downloaded images are run through Jimp
(`reduceSharpnessDesaturateAndBlurEdges`) to slightly alter them. This and
the random price offset (`getCarData#randomPriceOffset`) / random
registration year (`randomRegistrationYear`) exist to evade Avtonet's
duplicate detection. Don't remove these without checking with the user.

##### Captcha

`renew-ad/solve-captcha.js` handles a math-problem CAPTCHA: parses two
numbers from a `<p>` inside the second-to-last `<table>`, types the sum into
`input[name="ReadTotal"]` with human-like per-digit delays. Steel sessions
also have `solveCaptcha: true` enabled at the platform layer for
Turnstile-style challenges.

##### Image upload via Steel session files

`renew-ad/upload-images.js` doesn't pass local paths to `puppeteer`'s
`uploadFile` directly — it first uploads each local file to the Steel session
via `steelClient.sessions.files.upload(sessionId, …)`, then hands the
returned session-side path to puppeteer. The `sessionId` is threaded down
from `setupBrowser` through `renewAd`. If you add a new flow that uploads
files, follow this two-step pattern.

##### Ad-type quirks

- `car`: full brand/model/oblika/fuel/registration flow.
- `dostavna` (delivery vans): brand/model fall back to `znamkaTEMP` /
  `modelTEMP` fields when the regular names aren't present (see
  `select-brand-and-model.js`).
- `platisca` (wheel rims): skips the entire brand/model/registration step in
  `createNewAd`; uses a different new-ad URL and a different hash key-set in
  `generateAdHash*`.

### Build / packaging gotchas

- `build:dll` (run by `postinstall`) builds the dev DLL — if the renderer
  dev-server complains "DLL missing", run `npm run postinstall`.
- `electron-builder` bundles `node_modules/puppeteer/.local-chromium/**` as
  an extra resource (`package.json#build.extraResources`). Even though the
  runtime uses `puppeteer-core` against Steel, removing this would break any
  code path that still expects bundled Chromium.
- Auto-update publishes to `github:galjeza/anbot`. Bumping the runtime
  version means editing `release/app/package.json#version`, not the
  top-level one.

---

## Part 2 — Chrome extension (`chrome-extension/`)

Manifest V3 rewrite of the Electron app. Same behavior, executed inside the
user's real Chrome tab. **Vanilla JS, no build step, no npm dependencies** —
load it unpacked from `chrome-extension/` and Chrome runs it as-is.

### Commands

None. The directory is the deliverable. Edits take effect after clicking the
refresh ↻ button on the extension card at `chrome://extensions`.

### Install (for testing)

1. `chrome://extensions` → toggle **Developer mode** on
2. **Load unpacked** → select `chrome-extension/`
3. Pin to toolbar

### Use

1. Sign in to avto.net manually in any tab — the extension never types
   credentials.
2. Click toolbar icon → **Odpri nadzorno ploščo** → in **Konfiguracija** save
   the email tied to the subscription.
3. Dashboard's **Obnovi …** buttons drive the avto.net tab through
   list → edit → delete → recreate → upload, with a configurable pause
   between ads. The dashboard streams progress; **Prekliči** stops cleanly
   between steps.

### Architecture (vs the Electron app)

| Electron piece                              | Chrome-extension equivalent                                           |
| ------------------------------------------- | --------------------------------------------------------------------- |
| `src/main/main.ts` IPC + orchestration      | `background/service-worker.js`                                        |
| `src/scraper/utils/browser-utils.js` (Steel)| `chrome.tabs` + `chrome.scripting` — the user's own browser tab       |
| Puppeteer `page.goto` / `page.waitFor*`     | `chrome.tabs.update` + `chrome.tabs.onUpdated` + content-script ping  |
| Puppeteer DOM access                        | Direct DOM in `content/*.js` (one isolated world per avto.net tab)    |
| `electron-store`                            | `chrome.storage.local` (key: `userData`, schema: `{ email, brokerId, subscriptionPaidTo, hdImages }` — **no password**) |
| Filesystem `AdImages/<hash>/`               | IndexedDB `anbot-image-cache` (same 4-hash priority order in `content/ad-hash.js`) |
| Jimp blur/desaturate                        | `OffscreenCanvas` + `ctx.filter` in `content/image-process.js`        |
| Steel `sessions.files.upload` → puppeteer   | `DataTransfer` → `<input type=file>.files` + `change` event           |
| Math captcha solver (`solve-captcha.js`)    | Same logic, vanilla DOM (`content/solve-captcha.js`)                  |
| `loginToAvtonet` (typed credentials)        | **Deleted.** User signs in manually; background only does a one-shot `verifyLoggedIn` per batch by navigating to `welcome.asp` |
| React Router pages (`Menu`, `UpdateUser`, …)| Plain HTML pages under `pages/*.html` with vanilla JS                 |
| `electron-updater`                          | _Not ported._ Update via the Chrome Web Store or `Reload` button      |

### Layout

```
chrome-extension/
├── manifest.json                  # MV3
├── README.md
├── background/service-worker.js   # orchestrator + RPC surface
├── content/                       # injected into www.avto.net (isolated world)
│   ├── constants.js               # URLs + selectors  ── window.AnBot namespace
│   ├── utils.js                   # wait / waitForSelector / typing helpers
│   ├── ad-hash.js                 # 4-version cache-key generator
│   ├── image-process.js           # canvas-based Jimp replacement
│   ├── image-cache.js             # IndexedDB image cache
│   ├── solve-captcha.js
│   ├── login.js                   # ONLY exposes isAlreadyLoggedIn
│   ├── fetch-active-ads.js
│   ├── get-car-data.js
│   ├── delete-old-ad.js
│   ├── select-brand-and-model.js
│   ├── set-fuel-type.js
│   ├── set-registration-values.js
│   ├── fill-form-fields.js
│   ├── get-new-ad-url.js
│   ├── create-new-ad.js
│   ├── upload-images.js
│   └── content.js                 # RPC dispatcher  (loaded LAST)
├── pages/                         # dashboard UI (no React, no build)
│   ├── shared.css / shared.js
│   ├── menu.html / menu.js
│   ├── settings.html / settings.js
│   ├── adlist.html / adlist.js
│   └── obnavljanje.html / obnavljanje.js
├── popup/
│   ├── popup.html
│   └── popup.js
└── icons/{16,32,48,128}.png       # copies of assets/icons/*
```

### Conventions (chrome-extension)

- **No build step.** Don't introduce one. The extension is loaded unpacked
  and shipped as-is. If you need bundling later, treat it as a one-way door.
- **Content scripts share a `window.AnBot` namespace.** Each file IIFEs and
  assigns to `window.AnBot.<module>`. Order in `manifest.json#content_scripts.js`
  is dependency order — `constants.js` first, `content.js` last (it pulls
  from every other module). If you add a new content script, list it before
  `content.js`.
- **No ES module imports in content scripts.** MV3 content scripts can't use
  static `import`. Extension pages (`pages/*.js`) use `<script type="module">`
  and `import` from `shared.js` — that's fine.
- **CSP forbids remote scripts.** No Tailwind CDN, no Google Fonts, no
  remote anything. UI styling lives in `pages/shared.css`. Inline `<script>`
  is also blocked; every page references a separate `.js` file.
- **No password storage.** Don't add a password field back to settings. The
  user signs in manually; the background calls `verifyLoggedIn` (one
  `chrome.tabs.update → welcome.asp` round-trip) once per batch and throws a
  Slovenian error if redirected to the login form.
- **Don't `console.log` PII.** Logging the user's email is fine for
  debugging the subscription lookup; never log credentials (we don't have
  any to log) or the avto.net session cookie.
- **Tab control via the background only.** The dashboard UI never calls
  `chrome.tabs.*` directly — it sends an RPC to the service worker, which
  resolves an avto.net tab via `ensureAvtoTab(windowId)` (reuse → create) and
  drives it. This keeps the orchestration linear and testable.
- **One job at a time.** `runRenewalJob` rejects if `jobState.status ===
  'running'`. Cancel via the **Prekliči** button (`cancel-job` RPC sets
  `jobState.cancelled = true`, and `checkCancelled()` throws on the next
  await boundary).

### RPC surfaces

Two distinct message channels:

1. **Page ↔ background** (`chrome.runtime.sendMessage`). Envelope:
   `{ rpc: '<name>', payload }`. Handlers live in `service-worker.js#rpc`.
   Names: `open-dashboard`, `get-user-data`, `set-user-data`,
   `fetch-user-meta`, `get-ads`, `start-renew`, `get-job-state`, `cancel-job`.
2. **Background → content script** (`chrome.tabs.sendMessage`). Envelope:
   `{ command: '<name>', payload }`. Handlers live in `content/content.js#handlers`.
   The content script always replies with `{ data }` or `{ error }`.

3. **Background → dashboard progress** (`chrome.runtime.connect({ name:
   'job-progress' })`). One-way `port.postMessage({ type: 'progress', state })`
   stream on every `updateJob` call.

### Image cache notes

- IndexedDB database name: `anbot-image-cache`, store: `images`. Keys:
  `${hash}/${index}` for the blob, `${hash}/__manifest__` for the count.
- The cache lives in the **avto.net origin's** IndexedDB (content scripts
  share IndexedDB with the host page). That's intentional — keeps image
  fetches CORS-free. If you ever need cross-tab/cross-origin sharing, move
  the cache to the background's `caches.open()` instead.
- The 4-hash priority order from the Electron app
  (`getAdImagesDirectory` → simple / legacyV3 / V2 / V1) is preserved in
  `content/ad-hash.js#pickCacheKey`. Don't simplify it.

### Gotchas

- **Service worker shutdown.** MV3 may suspend the SW during long pauses.
  The dashboard's `job-progress` port keeps it alive. If you add a new
  long-running background flow, ensure a port is open or use
  `chrome.alarms` to wake.
- **Race between `chrome.tabs.update` and content-script readiness.** The
  background's `waitForTabReady` listens for `status: 'complete'` AND pings
  the content script. Don't replace one with the other.
- **CKEditor lives in the page world, not the content-script world.**
  `fill-form-fields.js#fillWysiwygOpis` injects a `<script>` tag into the
  page to call `window.CKEDITOR.instances.editor1.setData(...)`. Keep that
  injection pattern for any other host-page-global access.
- **Captcha 12-second sleep after entering the answer is intentional** —
  matches the Electron app's human-pause heuristic. Don't shorten without
  testing.

---

## Things common to both implementations

- `https://avtonet-server.onrender.com/user?email=…` is the source of truth
  for `brokerId`, `subscriptionPaidTo`, and `hdImages`. Both apps cache the
  response into their local store (`electron-store` userData /
  `chrome.storage.local#userData`).
- The three ad-type URLs in `src/scraper/utils/constants.ts#AVTONET_URLS`
  and `chrome-extension/content/constants.js#AVTONET_URLS` are duplicates.
  If you change one, change the other.
- The captcha and the duplicate-detection countermeasures (random price
  offset, random reg year, image blur/desaturate for non-HD) are intentional
  evasion — don't remove from either implementation without checking with
  the user.
