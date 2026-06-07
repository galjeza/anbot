// Background service worker (MV3). Drives all tab navigation and message
// passing to the content scripts injected on www.avto.net. Mirrors the
// orchestration that used to live in src/main/main.ts + src/scraper/.

const AVTONETEDITPREFIX =
  'https://www.avto.net/_2016mojavtonet/ad_edit.asp?id=';
const AVTONET_IMAGES_PREFIX =
  'https://www.avto.net/_2016mojavtonet/ad_photos_edit.asp?id=';
const LOGIN_URL = 'https://www.avto.net/_2016mojavtonet/';
const LOGIN_SUCCESS_URL = 'https://www.avto.net/_2016mojavtonet/welcome.asp';

const AVTONET_URLS = {
  car: 'https://www.avto.net/Ads/results.asp?znamka=&model=&modelID=&tip=&znamka2=&model2=&tip2=&znamka3=&model3=&tip3=&cenaMin=0&cenaMax=999999&letnikMin=0&letnikMax=2090&bencin=0&starost2=999&oblika=0&ccmMin=0&ccmMax=99999&mocMin=0&mocMax=999999&kmMin=0&kmMax=9999999&kwMin=0&kwMax=999999&motortakt=0&motorvalji=0&lokacija=0&sirina=0&dolzina=&dolzinaMIN=0&dolzinaMAX=100&nosilnostMIN=0&nosilnostMAX=999999&lezisc=&presek=0&premer=0&col=0&vijakov=0&EToznaka=0&vozilo=&airbag=&barva=&barvaint=&EQ1=1000000000&EQ2=1000000000&EQ3=1000000000&EQ4=100000000&EQ5=1000000000&EQ6=1000001000&EQ7=1110100120&EQ8=101000000&EQ9=1000000000&KAT=1010000000&PIA=&PIAzero=&PIAOut=&PSLO=&akcija=0&paketgarancije=&prikazkategorije=0&kategorija=0&ONLvid=0&ONLnak=0&zaloga=10&arhiv=0&presort=3&tipsort=DESC&stran=1&subSORT=3&subTIPSORT=ASC&broker=',
  dostavna:
    'https://www.avto.net/Ads/results.asp?znamka=&model=&modelID=&tip=&znamka2=&model2=&tip2=&znamka3=&model3=&tip3=&cenaMin=0&cenaMax=999999&letnikMin=0&letnikMax=2090&bencin=0&starost2=999&oblika=0&ccmMin=0&ccmMax=99999&mocMin=0&mocMax=999999&kmMin=0&kmMax=9999999&kwMin=0&kwMax=999999&motortakt=0&motorvalji=0&lokacija=0&sirina=0&dolzina=&dolzinaMIN=0&dolzinaMAX=100&nosilnostMIN=0&nosilnostMAX=999999&sedezevMIN=0&sedezevMAX=9&lezisc=&presek=0&premer=0&col=0&vijakov=0&EToznaka=0&vozilo=&airbag=&barva=&barvaint=&doseg=0&EQ1=1000000000&EQ2=1000000000&EQ3=1000000000&EQ4=100000000&EQ5=1000000000&EQ6=1000001000&EQ7=1110100120&EQ8=101000000&EQ9=1000000020&KAT=1020000000&PIA=&PIAzero=&PIAOut=&PSLO=&akcija=0&paketgarancije=&broker=',
  platisca:
    'https://www.avto.net/Ads/results.asp?znamka=&model=&modelID=&tip=&znamka2=&model2=&tip2=&znamka3=&model3=&tip3=&cenaMin=0&cenaMax=999999&letnikMin=0&letnikMax=2090&bencin=0&starost2=999&oblika=0&ccmMin=0&ccmMax=99999&mocMin=0&mocMax=999999&kmMin=0&kmMax=9999999&kwMin=0&kwMax=999999&motortakt=0&motorvalji=0&lokacija=0&sirina=0&dolzina=&dolzinaMIN=0&dolzinaMAX=100&nosilnostMIN=0&nosilnostMAX=999999&sedezevMIN=0&sedezevMAX=9&lezisc=&presek=0&premer=0&col=0&vijakov=0&EToznaka=0&vozilo=0&airbag=&barva=&barvaint=&doseg=0&BkType=0&BkOkvir=0&BkOkvirType=0&Bk4=0&EQ1=1000000000&EQ2=1000000000&EQ3=1000000000&EQ4=100000000&EQ5=1000000000&EQ6=1000001000&EQ7=1110100122&EQ8=101000000&EQ9=1000000020&EQ10=100000000&KAT=1100000000&PIA=&PIAzero=&PIAOut=&PSLO=&akcija=0&paketgarancije=&broker=',
};

const NEW_AD_URL = {
  car: 'https://www.avto.net/_2016mojavtonet/ad_select_rubric_icons.asp?SID=10000',
  dostavna:
    'https://www.avto.net/_2016mojavtonet/ad_insert_car_step1.asp?SID=20000',
  platisca:
    'https://www.avto.net/_2016mojavtonet/ad_select_rubric_continue.asp?KodaRubrike=R10KAT1010',
};

// -------------------------------- Job state --------------------------------

// One running renewal job at a time. The job's progress is broadcast to any
// extension page that subscribes via runtime.connect. Survives across the
// rare service-worker shutdowns by writing to chrome.storage.session before
// each major step, but jobs are best run with the dashboard tab open.
const jobState = {
  status: 'idle', // 'idle' | 'running' | 'completed' | 'error' | 'cancelled'
  total: 0,
  current: 0,
  currentAdId: null,
  step: '',
  error: null,
  startedAt: null,
  finishedAt: null,
  pauseMinutes: 0,
  pauseRemainingMs: 0,
  adType: null,
  testMode: false,
  tabId: null,
  cancelled: false,
};

const progressPorts = new Set();

const broadcastProgress = () => {
  const snapshot = { ...jobState };
  for (const port of progressPorts) {
    try {
      port.postMessage({ type: 'progress', state: snapshot });
    } catch {
      // port might be closed
    }
  }
};

const updateJob = (patch) => {
  Object.assign(jobState, patch);
  broadcastProgress();
};

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'job-progress') return;
  progressPorts.add(port);
  port.postMessage({ type: 'progress', state: { ...jobState } });
  port.onDisconnect.addListener(() => progressPorts.delete(port));
  port.onMessage.addListener((msg) => {
    if (msg?.type === 'cancel') {
      jobState.cancelled = true;
      broadcastProgress();
    }
  });
});

// ------------------------ Tab + messaging helpers --------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const checkCancelled = () => {
  if (jobState.cancelled) {
    throw new Error('CANCELLED');
  }
};

// Find an existing avto.net tab in any window; fall back to creating a new
// one. The window the dashboard lives in is preferred so the user watches the
// action happen alongside the control UI.
const ensureAvtoTab = async (preferWindowId) => {
  if (jobState.tabId) {
    try {
      const tab = await chrome.tabs.get(jobState.tabId);
      if (tab) return tab;
    } catch {
      // tab gone, fall through
    }
  }
  const tabs = await chrome.tabs.query({ url: 'https://www.avto.net/*' });
  if (tabs.length > 0) {
    jobState.tabId = tabs[0].id;
    return tabs[0];
  }
  const tab = await chrome.tabs.create({
    url: LOGIN_URL,
    active: false,
    windowId: preferWindowId,
  });
  jobState.tabId = tab.id;
  return tab;
};

// Wait until the content script in the tab answers a ping (i.e. the DOM is
// interactive). avto.net pages keep loading trackers/ads forever, so we don't
// gate on `status === 'complete'` — each scraper waits for the specific
// elements it needs via waitForSelector.
//
// Pass `expectUrl` when we navigated to a known URL — we require the ping to
// come from that URL prefix. Pass `previousUrl` when we triggered a form
// submit / reload and don't know the destination — we require the ping to
// come from any URL OTHER than the previous one. Without either, we accept
// any ping, which can race with navigation teardown (the old page may pong
// briefly before being killed).
const waitForTabReady = async (
  tabId,
  { expectUrl, previousUrl, timeoutMs = 60_000 } = {},
) => {
  const deadline = Date.now() + timeoutMs;
  // Small initial delay so an in-flight navigation has a chance to start
  // tearing down the old document before we ping.
  await sleep(300);
  const expectPrefix = expectUrl ? expectUrl.split(/[?#]/)[0] : null;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const pong = await sendToTab(tabId, 'ping');
      if (expectPrefix) {
        if (pong?.url && pong.url.startsWith(expectPrefix)) return pong;
        lastErr = new Error(
          `URL ${pong?.url} does not match expected ${expectUrl}`,
        );
      } else if (previousUrl) {
        if (pong?.url && pong.url !== previousUrl) return pong;
        lastErr = new Error(`URL still at previous ${previousUrl}`);
      } else {
        return pong;
      }
    } catch (e) {
      lastErr = e;
    }
    await sleep(300);
  }
  throw new Error(
    `waitForTabReady: ${lastErr?.message || 'no response'}${expectUrl ? ` (expected ${expectUrl})` : ''}${previousUrl ? ` (was ${previousUrl})` : ''}`,
  );
};

const sendToTab = (tabId, command, payload) =>
  new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { command, payload }, (response) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      if (!response) {
        return reject(new Error('Empty response from content script'));
      }
      if (response.error) {
        return reject(new Error(response.error));
      }
      resolve(response.data);
    });
  });

// Used when the command we send is expected to trigger navigation. The
// content script may not get to call sendResponse before the page tears down,
// which surfaces as "message channel closed". That's expected — the response
// would just be undefined data anyway. After the call, the caller should
// waitForTabReady with previousUrl/expectUrl to confirm the navigation
// actually happened.
const sendToTabFireAndForget = async (tabId, command, payload) => {
  try {
    await sendToTab(tabId, command, payload);
  } catch (e) {
    if (
      /message channel closed|Could not establish connection|Receiving end does not exist/i.test(
        e.message || '',
      )
    ) {
      return;
    }
    throw e;
  }
};

const getCurrentTabUrl = async (tabId) => {
  const tab = await chrome.tabs.get(tabId);
  return tab.url || '';
};

const navigateAndWait = async (tabId, url) => {
  await chrome.tabs.update(tabId, { url });
  await waitForTabReady(tabId, { expectUrl: url });
};

// ----------------------------- Fetch active ads ----------------------------

const fetchActiveAds = async (brokerId, adType, preferWindowId) => {
  const listUrl = `${AVTONET_URLS[adType]}${brokerId}`;
  const tab = await ensureAvtoTab(preferWindowId);
  await verifyLoggedIn(tab.id);
  await navigateAndWait(tab.id, listUrl);

  const allAds = [];
  while (true) {
    const { ads, nextUrl } = await sendToTab(tab.id, 'scrapeAdsPage');
    allAds.push(...ads);
    if (!nextUrl) break;
    await navigateAndWait(tab.id, nextUrl);
  }
  return allAds;
};

// ----------------------------- Session check -------------------------------

// The user signs in via the avto.net tab themselves — we never store or type
// credentials. Before a batch starts we just verify the welcome page resolves
// without a redirect to the login form, and surface a clear error if not.
const verifyLoggedIn = async (tabId) => {
  await navigateAndWait(tabId, LOGIN_SUCCESS_URL);
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url || !tab.url.startsWith(LOGIN_SUCCESS_URL)) {
    throw new Error(
      'Niste prijavljeni v avto.net. Odprite https://www.avto.net/_2016mojavtonet/ in se prijavite, nato poskusite znova.',
    );
  }
};

// ----------------------------- Renewal pipeline ----------------------------

const renewSingleAd = async (
  tabId,
  adId,
  { hdImages, adType, testMode },
) => {
  // Edit form scrape
  updateJob({ step: 'scrape-edit-form' });
  checkCancelled();
  await navigateAndWait(tabId, `${AVTONETEDITPREFIX}${adId}`);
  const carData = await sendToTab(tabId, 'scrapeEditForm', { adId });

  // Mutate price + year, solve captcha, submit
  if (!testMode) {
    updateJob({ step: 'submit-edit' });
    checkCancelled();
    const beforeUrl = await getCurrentTabUrl(tabId);
    await sendToTabFireAndForget(tabId, 'mutateAndSubmitEdit', { carData });
    await waitForTabReady(tabId, { previousUrl: beforeUrl });
  }

  // Images
  updateJob({ step: 'scrape-image-urls' });
  checkCancelled();
  await navigateAndWait(tabId, `${AVTONET_IMAGES_PREFIX}${adId}`);
  const imageUrls = await sendToTab(tabId, 'scrapeImageUrls', { hdImages });
  carData.push({ name: 'images', value: imageUrls });

  updateJob({ step: 'cache-images' });
  checkCancelled();
  const { cacheKey } = await sendToTab(tabId, 'cacheImages', {
    carData,
    imageUrls,
    hdImages,
    adType,
  });

  // Delete old (skip in test mode)
  if (!testMode) {
    updateJob({ step: 'delete-old' });
    checkCancelled();
    await navigateAndWait(
      tabId,
      `https://www.avto.net/_2016mojavtonet/ad_delete.asp?id=${encodeURIComponent(adId)}`,
    );
    await sendToTab(tabId, 'confirmDelete');
  } else {
    console.log('[renewAd] Test mode — skipping delete');
  }

  // Create new ad
  updateJob({ step: 'new-ad-step1' });
  checkCancelled();
  await navigateAndWait(tabId, NEW_AD_URL[adType]);
  const step1Result = await sendToTab(tabId, 'createNewAdStep1', {
    carData,
    adType,
  });

  if (!step1Result.skipped) {
    // potrdi caused navigation
    await waitForTabReady(tabId, { previousUrl: NEW_AD_URL[adType] });
    if (adType === 'car') {
      updateJob({ step: 'click-supurl' });
      // .supurl is an in-page click (expands a section) — no navigation.
      await sendToTab(tabId, 'clickSupurl');
    }
  }

  // Wait for the cena field to appear, then reload the tab (mirroring the
  // original puppeteer flow that reloaded once to settle state). Doing the
  // reload from the background gives us a clean navigation boundary.
  updateJob({ step: 'fill-form-first-pass' });
  checkCancelled();
  await sendToTab(tabId, 'waitForCenaInput');
  await chrome.tabs.reload(tabId);
  await waitForTabReady(tabId);

  updateJob({ step: 'fill-form-and-submit' });
  checkCancelled();
  const beforeFinalSubmit = await getCurrentTabUrl(tabId);
  await sendToTabFireAndForget(tabId, 'fillFormAfterReload', { carData, adType });
  // EDITAD click navigates to image upload page.
  await waitForTabReady(tabId, { previousUrl: beforeFinalSubmit });

  // Upload images
  updateJob({ step: 'upload-images' });
  checkCancelled();
  await sendToTab(tabId, 'uploadCachedImages', {
    cacheKey,
    expectedCount: imageUrls.length,
  });
};

const runRenewalJob = async ({ ads, pause, adType, testMode, windowId }) => {
  const { userData } = await chrome.storage.local.get('userData');
  if (!userData) throw new Error('No userData saved. Open settings first.');

  const tab = await ensureAvtoTab(windowId);
  updateJob({
    status: 'running',
    total: ads.length,
    current: 0,
    pauseMinutes: pause,
    pauseRemainingMs: 0,
    adType,
    testMode,
    tabId: tab.id,
    startedAt: Date.now(),
    finishedAt: null,
    error: null,
    cancelled: false,
  });

  try {
    updateJob({ step: 'verify-login' });
    await verifyLoggedIn(tab.id);

    for (let i = 0; i < ads.length; i += 1) {
      checkCancelled();
      updateJob({ current: i + 1, currentAdId: ads[i].adId, step: 'starting' });
      await renewSingleAd(tab.id, ads[i].adId, {
        hdImages: !!userData.hdImages,
        adType,
        testMode,
      });

      if (i < ads.length - 1) {
        const pauseMs = pause * 60 * 1000;
        updateJob({ step: 'pause', pauseRemainingMs: pauseMs });
        const sliceMs = 1000;
        let remaining = pauseMs;
        while (remaining > 0) {
          checkCancelled();
          await sleep(Math.min(sliceMs, remaining));
          remaining -= sliceMs;
          updateJob({ pauseRemainingMs: Math.max(0, remaining) });
        }
      }
    }
    updateJob({
      status: 'completed',
      finishedAt: Date.now(),
      step: 'done',
      pauseRemainingMs: 0,
    });
  } catch (e) {
    if (e.message === 'CANCELLED') {
      updateJob({
        status: 'cancelled',
        finishedAt: Date.now(),
        step: 'cancelled',
      });
    } else {
      console.error('[renewal-job] Failed', e);
      updateJob({
        status: 'error',
        error: e.message || String(e),
        finishedAt: Date.now(),
      });
    }
  }
};

// --------------------------- Top-level RPC surface -------------------------

const rpc = {
  'open-dashboard': async () => {
    const url = chrome.runtime.getURL('pages/menu.html');
    const existing = await chrome.tabs.query({ url });
    if (existing.length > 0) {
      await chrome.tabs.update(existing[0].id, { active: true });
      await chrome.windows.update(existing[0].windowId, { focused: true });
      return { tabId: existing[0].id };
    }
    const tab = await chrome.tabs.create({ url });
    return { tabId: tab.id };
  },

  'get-user-data': async () => {
    const { userData } = await chrome.storage.local.get('userData');
    return userData || null;
  },

  'set-user-data': async (payload) => {
    await chrome.storage.local.set({ userData: payload });
    return true;
  },

  'fetch-user-meta': async ({ email }) => {
    const resp = await fetch(
      `https://avtonet-server.onrender.com/user?email=${encodeURIComponent(email)}`,
    );
    if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
    return resp.json();
  },

  // Image fetch on behalf of the content script. images.avto.net blocks
  // cross-origin fetches from www.avto.net (CORS), but the service worker
  // gets host-permission-based bypass. Bytes are returned as base64 because
  // chrome.runtime.sendMessage uses JSON-only serialization.
  'fetch-image': async ({ url }) => {
    const resp = await fetch(url);
    if (!resp.ok) return { ok: false, status: resp.status };
    const buf = await resp.arrayBuffer();
    const mimeType = resp.headers.get('content-type') || 'image/jpeg';
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(
        null,
        bytes.subarray(i, i + chunkSize),
      );
    }
    return { ok: true, base64: btoa(binary), mimeType };
  },

  'get-ads': async ({ adType, windowId }) => {
    const { userData } = await chrome.storage.local.get('userData');
    if (!userData?.brokerId) throw new Error('Missing brokerId — refresh dashboard first');
    return fetchActiveAds(userData.brokerId, adType, windowId);
  },

  'start-renew': async ({ ads, pause, adType, testMode, windowId }) => {
    if (jobState.status === 'running') {
      throw new Error('A renewal job is already running');
    }
    // Fire and forget — progress streams via runtime.connect.
    runRenewalJob({ ads, pause, adType, testMode, windowId });
    return { started: true };
  },

  'get-job-state': async () => ({ ...jobState }),

  'cancel-job': async () => {
    if (jobState.status !== 'running') return { cancelled: false };
    jobState.cancelled = true;
    broadcastProgress();
    return { cancelled: true };
  },
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg !== 'object' || !msg.rpc) return false;
  const handler = rpc[msg.rpc];
  if (!handler) {
    sendResponse({ error: `Unknown rpc: ${msg.rpc}` });
    return false;
  }
  (async () => {
    try {
      const data = await handler(msg.payload || {});
      sendResponse({ data });
    } catch (e) {
      console.error('[rpc error]', msg.rpc, e);
      sendResponse({ error: e?.message || String(e) });
    }
  })();
  return true;
});

chrome.action.onClicked?.addListener(async () => {
  await rpc['open-dashboard']();
});

console.log('[AnBot SW] Loaded');
