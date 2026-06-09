# Avtonet Bot — Chrome Extension

A Manifest V3 rewrite of the Electron app in `../src/`. Same behavior, but the
work happens inside the avto.net tab the user already has open — no Steel.dev
cloud browser, no Puppeteer, no separate dashboard tab.

## Install (unpacked)

1. Open `chrome://extensions`.
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and select this `chrome-extension/` directory.
4. Pin the extension to the toolbar.

## Use

1. Open `https://www.avto.net/_2016mojavtonet/` in a regular tab and **sign
   in**. The extension never types credentials.
2. With that avto.net tab active, click the extension's toolbar icon. The
   popup is the whole UI — there is no separate dashboard tab.
3. First time only: open **Konfiguracija** in the popup and save your avto.net
   email. It's used to look up your `brokerId` + subscription state from
   `avtonet-server.onrender.com`.
4. Click **Obnovi avtomobile / dostavna / platišča**. The extension drives the
   avto.net tab through list/edit/delete/recreate/upload with the same pauses
   between ads as the Electron app.
5. You can close the popup — the renewal keeps running. Reopen the popup any
   time to see live progress, or to cancel via **Prekliči**.

## Architecture (vs the Electron app)

| Electron piece                              | Chrome-extension equivalent                                           |
| ------------------------------------------- | --------------------------------------------------------------------- |
| `src/main/main.ts` IPC + orchestration      | `background/service-worker.js`                                        |
| `src/scraper/utils/browser-utils.js` (Steel)| `chrome.tabs` + `chrome.scripting` — the user's own avto.net tab      |
| Puppeteer `page.goto` / `page.waitFor*`     | `chrome.tabs.update` + `chrome.tabs.onUpdated` + content-script ping  |
| Puppeteer DOM access                        | Direct DOM in `content/*.js` (one isolated world per avto.net tab)    |
| `electron-store`                            | `chrome.storage.local` (key: `userData`)                              |
| Filesystem `AdImages/<hash>/`               | IndexedDB `anbot-image-cache` (same 4-hash priority order)            |
| Jimp blur/desaturate                        | `OffscreenCanvas` + `ctx.filter` in `content/image-process.js`        |
| Steel `sessions.files.upload` → puppeteer   | `DataTransfer` → `<input type=file>.files` + `change` event           |
| Math captcha solver (`solve-captcha.js`)    | Same logic, vanilla DOM (`content/solve-captcha.js`)                  |
| React Router pages                          | Single popup with four views (`popup/popup.js`)                       |
| `electron-updater`                          | _Not ported._ Update via the Chrome Web Store or `Reload` button      |

## Files

```
chrome-extension/
├── manifest.json
├── background/service-worker.js   # orchestrator + job state
├── content/                       # injected into www.avto.net
│   ├── constants.js
│   ├── utils.js                   # wait / waitForSelector / typing helpers
│   ├── ad-hash.js                 # 4-version cache-key generator
│   ├── image-process.js           # canvas-based Jimp replacement
│   ├── image-cache.js             # IndexedDB image cache
│   ├── solve-captcha.js
│   ├── login.js                   # session verification only
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
├── popup/                         # the entire UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js                   # menu / settings / adlist / obnavljanje
└── icons/
```

## Notes & limitations

- **No password storage.** The Electron app stored `email` + `password` and
  re-submitted the login form on every renewal. The extension drops the
  password entirely and relies on the user's existing avto.net session — if
  the session expires you'll see a clear "Niste prijavljeni" error and can
  sign in manually.
- **Controls the active tab.** The extension does not create a tab — it uses
  whichever avto.net tab is currently active in the focused window. If you
  haven't opened avto.net yet, it shows an error and tells you to open it.
  Once a job starts, it sticks to that tab for the duration of the job.
- **Popup-only UI.** All four screens (menu, settings, ad list, progress)
  live inside the toolbar popup. Closing the popup does **not** cancel a job;
  the background service worker keeps driving the avto.net tab. Reopen the
  popup any time to see live progress.
- **No Steel proxy / Turnstile solver.** The user's real browser does both
  jobs — no rotating-IP risk, but avto.net's anti-bot heuristics see real
  activity.
- **Image cache lives on avto.net's origin.** IndexedDB in a content script
  shares an origin with the host page. Cross-origin fetches to
  `images.avto.net` go through the service worker which has host-permission
  bypass.
- **Single concurrent job.** `start-renew` rejects if a job is already
  running. Cancel with **Prekliči** before starting another.

## Disable the Electron build

The Electron app in `../src/` is unchanged — install it separately. Don't run
both at once or two browsers will compete for the same avto.net session.
