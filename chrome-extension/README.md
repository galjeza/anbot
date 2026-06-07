# Avtonet Bot — Chrome Extension

A Manifest V3 rewrite of the Electron app in `../src/`. Same behavior, but the
work happens inside a real Chrome tab the user can see — no Steel.dev cloud
browser and no Puppeteer.

## Install (unpacked)

1. Open `chrome://extensions`.
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and select this `chrome-extension/` directory.
4. Pin the extension to the toolbar.

## Use

1. Click the toolbar icon → **Odpri nadzorno ploščo**. A new tab opens with
   the same UI flow as the Electron app: Menu → Konfiguracija → Adlist →
   Obnavljanje.
2. **Sign in to avto.net in a regular browser tab first.** The extension
   never types credentials — it drives the session you already have.
3. First time only: open **Konfiguracija** and save your avto.net email. It's
   used to look up your `brokerId` + subscription state from
   `avtonet-server.onrender.com`.
4. Pick **Obnovi avtomobile / dostavna / platišča**. The extension verifies
   the session is alive (redirect to `welcome.asp`), then drives your
   `avto.net` tab through the list/edit/delete/recreate/upload flow with the
   same pauses between ads.
5. The avto.net tab is yours to watch. Closing it cancels the active step.
   Use the **Prekliči** button to stop cleanly between steps.

## Architecture (vs the Electron app)

| Electron piece                              | Chrome-extension equivalent                                           |
| ------------------------------------------- | --------------------------------------------------------------------- |
| `src/main/main.ts` IPC + orchestration      | `background/service-worker.js`                                        |
| `src/scraper/utils/browser-utils.js` (Steel)| `chrome.tabs` + `chrome.scripting` — the user's own browser tab       |
| Puppeteer `page.goto` / `page.waitFor*`     | `chrome.tabs.update` + `chrome.tabs.onUpdated` + content-script ping  |
| Puppeteer DOM access                        | Direct DOM in `content/*.js` (one isolated world per avto.net tab)    |
| `electron-store`                            | `chrome.storage.local` (key: `userData`)                              |
| Filesystem `AdImages/<hash>/`               | IndexedDB `anbot-image-cache` (same 4-hash priority order)            |
| Jimp blur/desaturate                        | `OffscreenCanvas` + `ctx.filter` in `content/image-process.js`        |
| Steel `sessions.files.upload` → puppeteer   | `DataTransfer` → `<input type=file>.files` + `change` event           |
| Math captcha solver (`solve-captcha.js`)    | Same logic, vanilla DOM (`content/solve-captcha.js`)                  |
| React Router pages (`Menu`, `UpdateUser`, …)| Plain HTML pages under `pages/*.html` with vanilla JS                 |
| `electron-updater`                          | _Not ported._ Update via the Chrome Web Store or `Reload` button      |

## Files

```
chrome-extension/
├── manifest.json
├── background/service-worker.js   # orchestrator
├── content/                       # injected into www.avto.net
│   ├── constants.js               # URLs + captcha selectors
│   ├── utils.js                   # wait / waitForSelector / typing helpers
│   ├── ad-hash.js                 # 4-version cache-key generator
│   ├── image-process.js           # canvas-based Jimp replacement
│   ├── image-cache.js             # IndexedDB image cache
│   ├── solve-captcha.js
│   ├── login.js
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
│   └── content.js                 # RPC dispatcher
├── pages/                         # dashboard UI
│   ├── shared.css / shared.js
│   ├── menu.html / menu.js
│   ├── settings.html / settings.js
│   ├── adlist.html / adlist.js
│   └── obnavljanje.html / obnavljanje.js
├── popup/
│   ├── popup.html
│   └── popup.js
└── icons/
```

## Notes & limitations

- **No password storage.** The Electron app stored `email` + `password` and
  re-submitted the login form on every renewal. The extension drops the
  password entirely and relies on the user's existing avto.net session — if
  the session expires you'll see a clear "Niste prijavljeni" error and can
  sign in manually.
- **No Steel proxy / Turnstile solver.** The user's real browser does both
  jobs — no rotating-IP risk, but it also means avto.net's anti-bot heuristics
  see real activity.
- **Image cache lives on avto.net's origin.** IndexedDB in a content script
  shares an origin with the host page. Avto.net code can see (but should not
  care about) the cached blobs. This trade keeps fetches CORS-free.
- **Service-worker shutdown.** MV3 may stop the background while a long pause
  is running. Keep the dashboard tab open during a job — its `runtime.connect`
  port keeps the worker alive.
- **Single concurrent job.** `start-renew` rejects if a job is already
  running. Cancel with **Prekliči** before starting another.
- **Auto-update unported.** The Electron `electron-updater` flow is not
  applicable; if you want gated UX based on a deployed version, add a check
  against `avtonet-server.onrender.com`.

## Disable the Electron build

The Electron app in `../src/` is unchanged — install it separately. Don't run
both at once or two browsers will compete for the same avto.net session.
