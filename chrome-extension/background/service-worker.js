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
  const stepChanged = patch.step && patch.step !== jobState.step;
  Object.assign(jobState, patch);
  if (stepChanged) {
    console.log(
      `[job] step → ${jobState.step} (ad ${jobState.currentAdId || '-'}, ${jobState.current}/${jobState.total})`,
    );
  }
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

// Resolve the avto.net tab to operate on. While a job is running we stick to
// the tab we started on. Otherwise we use the active tab in the current
// window if it's on avto.net. We never auto-create a tab — the popup-only
// flow requires the user to open avto.net themselves.
const resolveAvtoTab = async () => {
  if (jobState.tabId) {
    try {
      const tab = await chrome.tabs.get(jobState.tabId);
      if (tab) return tab;
    } catch {
      // tab gone, fall through
    }
  }
  const [active] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (!active || !active.url || !active.url.startsWith('https://www.avto.net/')) {
    throw new Error(
      'Trenutni zavihek ni odprt na avto.net. Odprite https://www.avto.net/_2016mojavtonet/, prijavite se in poskusite znova.',
    );
  }
  jobState.tabId = active.id;
  return active;
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

const getCurrentTabUrl = async (tabId) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab.url || '';
  } catch {
    return '';
  }
};

// Snapshot context that's useful when a message-channel failure is the cause:
// which command was sent, what step the job thought it was on, where the tab
// was, and how long ago we asked.
const buildSendContext = (command, urlAtCall, t0) => {
  const dt = Date.now() - t0;
  const step = jobState.step || '-';
  const ad = jobState.currentAdId ? ` ad=${jobState.currentAdId}` : '';
  return `cmd=${command} step=${step}${ad} url=${urlAtCall || '?'} took=${dt}ms`;
};

const sendToTab = async (tabId, command, payload) => {
  const t0 = Date.now();
  // ping is called every 300ms by waitForTabReady — keep it silent or the
  // console floods. Real commands are logged at start AND end.
  const verbose = command !== 'ping';
  const urlAtCall = await getCurrentTabUrl(tabId);
  if (verbose) {
    console.log(`[sendToTab] → ${command} (step=${jobState.step}, url=${urlAtCall})`);
  }
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { command, payload }, (response) => {
      const ctx = buildSendContext(command, urlAtCall, t0);
      if (chrome.runtime.lastError) {
        const msg = chrome.runtime.lastError.message;
        if (verbose) console.warn(`[sendToTab] ✗ ${command}: ${msg} | ${ctx}`);
        return reject(new Error(`${msg} [${ctx}]`));
      }
      if (!response) {
        if (verbose) console.warn(`[sendToTab] ✗ ${command}: empty response | ${ctx}`);
        return reject(new Error(`Empty response from content script [${ctx}]`));
      }
      if (response.error) {
        if (verbose) console.warn(`[sendToTab] ✗ ${command}: ${response.error} | ${ctx}`);
        return reject(new Error(`${response.error} [${ctx}]`));
      }
      if (verbose) console.log(`[sendToTab] ✓ ${command} (${Date.now() - t0}ms)`);
      resolve(response.data);
    });
  });
};

// Background-driven reload that waits safely for the new content script.
// Install the onUpdated listener before reloading, wait for 'loading' to
// confirm the old script is dead, poll ping safely, then wait for the page
// to stop generating loading events before declaring done.
const reloadAndAwaitContentScript = async (
  tabId,
  { timeoutMs = 60_000, stabilityMs = 1500, maxStabilityWaitMs = 20_000 } = {},
) => {
  const beforeUrl = await getCurrentTabUrl(tabId);
  let lastLoadingAt = null;
  const navListener = (updatedTabId, info) => {
    if (updatedTabId === tabId && info.status === 'loading') {
      lastLoadingAt = Date.now();
    }
  };
  chrome.tabs.onUpdated.addListener(navListener);
  try {
    await chrome.tabs.reload(tabId);
    const navDeadline = Date.now() + 10_000;
    while (!lastLoadingAt && Date.now() < navDeadline) {
      await sleep(100);
    }
    if (!lastLoadingAt) {
      throw new Error('Reload did not start within 10s');
    }
    await waitForTabReady(tabId, { expectUrl: beforeUrl, timeoutMs });
    const stabilityDeadline = Date.now() + maxStabilityWaitMs;
    while (Date.now() < stabilityDeadline) {
      if (Date.now() - lastLoadingAt >= stabilityMs) break;
      await sleep(150);
    }
  } finally {
    chrome.tabs.onUpdated.removeListener(navListener);
  }
};

// expectRedirect: when the URL we navigate to is known to 302 away (e.g.
// ad_delete.asp → details.asp?showalert=3), don't require the destination
// to start with our requested URL. Instead just wait until the tab is on
// any URL other than the one it was on before the navigate.
const navigateAndWait = async (tabId, url, { expectRedirect = false } = {}) => {
  const beforeUrl = expectRedirect ? await getCurrentTabUrl(tabId) : null;
  await chrome.tabs.update(tabId, { url });
  await waitForTabReady(
    tabId,
    expectRedirect ? { previousUrl: beforeUrl } : { expectUrl: url },
  );
};

// Click a selector in the tab via chrome.scripting.executeScript. Runs in the
// page's isolated world; bypasses runtime messaging so there is no
// sendResponse race when the click triggers navigation. Returns true if the
// element was clicked, false if it was not found.
const clickInTab = async (tabId, selector) => {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      el.click();
      return true;
    },
    args: [selector],
  });
  if (!result || result.result === false) {
    throw new Error(`Click target ${selector} not found`);
  }
};

// Install the onUpdated listener BEFORE clicking, so we never miss the
// 'loading' event. Then wait for the new content script to come up AND for
// the page to stop firing more navigation events (server redirects + JS
// reloads on first paint are common on avto.net).
const clickAndAwaitNavigation = async (
  tabId,
  selector,
  { timeoutMs = 60_000, stabilityMs = 1500, maxStabilityWaitMs = 20_000 } = {},
) => {
  const beforeUrl = await getCurrentTabUrl(tabId);
  let lastLoadingAt = null;
  const navListener = (updatedTabId, info) => {
    if (updatedTabId === tabId && info.status === 'loading') {
      lastLoadingAt = Date.now();
    }
  };
  chrome.tabs.onUpdated.addListener(navListener);
  try {
    await clickInTab(tabId, selector);
    const navDeadline = Date.now() + 10_000;
    while (!lastLoadingAt && Date.now() < navDeadline) {
      await sleep(100);
    }
    if (!lastLoadingAt) {
      throw new Error(
        `Navigation did not start within 10s after clicking ${selector}`,
      );
    }
    await waitForTabReady(tabId, { previousUrl: beforeUrl, timeoutMs });
    // Now wait for navigation activity to fully quiesce. Keep extending the
    // window every time a new loading event fires.
    const stabilityDeadline = Date.now() + maxStabilityWaitMs;
    while (Date.now() < stabilityDeadline) {
      if (Date.now() - lastLoadingAt >= stabilityMs) break;
      await sleep(150);
    }
    if (Date.now() - lastLoadingAt < stabilityMs) {
      console.warn(
        `[clickAndAwaitNavigation] tab still active after ${maxStabilityWaitMs}ms — proceeding anyway`,
      );
    }
  } finally {
    chrome.tabs.onUpdated.removeListener(navListener);
  }
};

// Wait until the tab has been navigation-quiet for stabilityMs. Use after an
// in-page action that might trigger an unobserved reload (e.g. clicking a
// link that does location = …).
const waitForTabStable = async (
  tabId,
  { stabilityMs = 1500, maxWaitMs = 20_000 } = {},
) => {
  let lastLoadingAt = Date.now();
  const navListener = (updatedTabId, info) => {
    if (updatedTabId === tabId && info.status === 'loading') {
      lastLoadingAt = Date.now();
    }
  };
  chrome.tabs.onUpdated.addListener(navListener);
  try {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      if (Date.now() - lastLoadingAt >= stabilityMs) {
        // Confirm a fresh content script is actually responsive before we
        // declare the tab stable.
        try {
          await sendToTab(tabId, 'ping');
          return;
        } catch {
          lastLoadingAt = Date.now();
        }
      }
      await sleep(150);
    }
    console.warn(
      `[waitForTabStable] gave up after ${maxWaitMs}ms — last loading event ${Date.now() - lastLoadingAt}ms ago`,
    );
  } finally {
    chrome.tabs.onUpdated.removeListener(navListener);
  }
};

// Retry a content-script command if the message channel closes mid-call
// (page reloaded itself, transient teardown). For scrape-style commands that
// don't intentionally trigger navigation. Re-navigates to renavigateUrl
// between attempts so the content script is back on the right page.
const sendToTabWithRetry = async (
  tabId,
  command,
  payload,
  { retries = 2, renavigateUrl } = {},
) => {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await sendToTab(tabId, command, payload);
    } catch (e) {
      lastErr = e;
      const transient = /message channel closed|Could not establish connection|Receiving end does not exist/i.test(
        e.message || '',
      );
      if (!transient || attempt === retries) throw e;
      console.warn(
        `[sendToTabWithRetry] ${command} failed (attempt ${attempt + 1}): ${e.message}`,
      );
      if (renavigateUrl) {
        await navigateAndWait(tabId, renavigateUrl);
      } else {
        await sleep(1000);
      }
    }
  }
  throw lastErr;
};

// ----------------------------- Fetch active ads ----------------------------

const fetchActiveAds = async (brokerId, adType) => {
  const listUrl = `${AVTONET_URLS[adType]}${brokerId}`;
  const tab = await resolveAvtoTab();
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
  const editUrl = `${AVTONETEDITPREFIX}${adId}`;
  await navigateAndWait(tabId, editUrl);
  // Retry on transient channel-closed (page may reload subresources or
  // briefly tear down the content script during heavy ad-page load).
  const carData = await sendToTabWithRetry(
    tabId,
    'scrapeEditForm',
    { adId },
    { renavigateUrl: editUrl },
  );

  // Mutate price + year, solve captcha — content script just prepares the
  // form; background clicks ADVIEW so the message channel never races the
  // form-submit navigation.
  if (!testMode) {
    updateJob({ step: 'submit-edit' });
    checkCancelled();
    await sendToTab(tabId, 'mutateEditForm', { carData });
    await clickAndAwaitNavigation(tabId, 'button[name=ADVIEW]');
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

  // Delete old (skip in test mode). ad_delete.asp 302s to
  // details.asp?ID=…&showalert=3 once the server processes the delete, so
  // we can't require the requested URL prefix — expectRedirect waits for
  // any new URL instead.
  if (!testMode) {
    updateJob({ step: 'delete-old' });
    checkCancelled();
    await navigateAndWait(
      tabId,
      `https://www.avto.net/_2016mojavtonet/ad_delete.asp?id=${encodeURIComponent(adId)}`,
      { expectRedirect: true },
    );
    await sendToTab(tabId, 'confirmDelete');
  } else {
    console.log('[renewAd] Test mode — skipping delete');
  }

  // Create new ad
  updateJob({ step: 'new-ad-step1' });
  checkCancelled();
  await navigateAndWait(tabId, NEW_AD_URL[adType]);

  if (adType !== 'platisca') {
    // createNewAdStep1 fills brand/model/oblika/etc; background clicks
    // potrdi (which navigates) so the message channel doesn't race.
    await sendToTab(tabId, 'createNewAdStep1', { carData, adType });
    await clickAndAwaitNavigation(tabId, 'button[name="potrdi"]');
    if (adType === 'car') {
      updateJob({ step: 'click-supurl' });
      // .supurl is an in-page click. On avto.net it sometimes re-triggers a
      // page reload — wait for the tab to stabilize before the next command
      // so we don't race a navigation.
      await sendToTab(tabId, 'clickSupurl');
      await waitForTabStable(tabId);
    }
  }

  // Wait for the cena field to appear, then reload the tab (mirroring the
  // original puppeteer flow that reloaded once to settle state). Retry on
  // channel-close in case the step2 page is still mid-init when we send.
  updateJob({ step: 'fill-form-first-pass' });
  checkCancelled();
  await sendToTabWithRetry(tabId, 'waitForCenaInput', {}, { retries: 3 });
  await reloadAndAwaitContentScript(tabId);

  updateJob({ step: 'fill-form-and-submit' });
  checkCancelled();
  // fillFormAfterReload fills fields + solves captcha; background clicks
  // EDITAD (which navigates to image upload) so the content script never
  // returns from a navigation-triggering click.
  await sendToTab(tabId, 'fillFormAfterReload', { carData, adType });
  await clickAndAwaitNavigation(tabId, 'button[name="EDITAD"]');

  // Upload images. Each successful upload triggers a server-side navigation
  // (ad_photos_upload.asp → ad_photos_edit_1by1.asp → …), so we drive the
  // loop from the background — one image per command — and let
  // waitForTabStable absorb whatever the page does between iterations.
  // .ButtonAddPhoto (which advances to the next slot) is clicked by the
  // background via executeScript, NOT inside the handler, so the
  // navigation it causes never tears down a live response channel.
  updateJob({ step: 'upload-images' });
  checkCancelled();
  await waitForTabStable(tabId);
  await sendToTabWithRetry(tabId, 'prepareUploadPage', {}, { retries: 2 });

  const { count: cachedCount } = await sendToTab(tabId, 'getCachedImageCount', {
    cacheKey,
  });
  const totalToUpload = Math.min(cachedCount, imageUrls.length);
  if (totalToUpload === 0) {
    throw new Error('No cached images to upload');
  }
  console.log(`[upload-images] uploading ${totalToUpload} images`);

  for (let i = 0; i < totalToUpload; i += 1) {
    checkCancelled();
    updateJob({ step: `upload-images (${i + 1}/${totalToUpload})` });
    await sendToTabWithRetry(
      tabId,
      'uploadOneImage',
      { cacheKey, index: i },
      { retries: 1 },
    );
    // The page's onChange XHR may navigate after the upload. Wait for the
    // tab to be quiet before we advance to the next slot.
    await waitForTabStable(tabId);
    if (i < totalToUpload - 1) {
      // Advance to the next file slot. We tolerate failure here — if the
      // button isn't on the page (different upload-flow variant), the next
      // uploadOneImage's findFileInput will click it via its own
      // maxAttempts loop.
      try {
        await clickInTab(tabId, '.ButtonAddPhoto');
        await waitForTabStable(tabId);
      } catch (e) {
        console.warn(
          `[upload-images] ButtonAddPhoto not found between images ${i} and ${i + 1}: ${e.message}`,
        );
      }
    }
  }
  updateJob({ step: 'upload-images' });
};

const runRenewalJob = async ({ ads, pause, adType, testMode }) => {
  const { userData } = await chrome.storage.local.get('userData');
  if (!userData) throw new Error('No userData saved. Open settings first.');

  const tab = await resolveAvtoTab();
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
      const ctx = `step=${jobState.step} ad=${jobState.currentAdId || '-'} (${jobState.current}/${jobState.total})`;
      console.error(`[renewal-job] Failed at ${ctx}`, e);
      const baseMsg = e.message || String(e);
      // Don't double-tag if sendToTab already attached [cmd=… step=…].
      const tagged = baseMsg.includes('[cmd=') ? baseMsg : `${baseMsg} [${ctx}]`;
      updateJob({
        status: 'error',
        error: tagged,
        finishedAt: Date.now(),
      });
    }
  }
};

// --------------------------- Top-level RPC surface -------------------------

const rpc = {
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

  'get-ads': async ({ adType }) => {
    const { userData } = await chrome.storage.local.get('userData');
    if (!userData?.brokerId) {
      throw new Error('Missing brokerId — open settings and refresh first');
    }
    return fetchActiveAds(userData.brokerId, adType);
  },

  'start-renew': async ({ ads, pause, adType, testMode }) => {
    if (jobState.status === 'running') {
      throw new Error('A renewal job is already running');
    }
    // Fire and forget — progress streams via runtime.connect.
    runRenewalJob({ ads, pause, adType, testMode });
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

console.log('[AnBot SW] Loaded');
