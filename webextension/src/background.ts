export {};

type LogLevel = 'info' | 'warn' | 'error';

type AdType = 'car' | 'dostavna' | 'platisca';

interface UserData {
  email: string;
  password: string;
  brokerId: string;
  subscriptionPaidTo: string;
  hdImages: boolean;
}

interface AdItem {
  name: string;
  price: string;
  photoUrl: string;
  adUrl: string;
  adId: string;
}

interface RenewalError {
  adId: string;
  message: string;
}

interface RenewalState {
  running: boolean;
  completed: number;
  total: number;
  currentAdId: string | null;
  message: string;
  errors: RenewalError[];
}

interface DebugLogEntry {
  ts: string;
  level: LogLevel;
  message: string;
  context: unknown;
}

const AVTONET_URLS: Record<AdType, string> = {
  car: 'https://www.avto.net/Ads/results.asp?B=1&OfferType=Dealer&broker=',
  dostavna: 'https://www.avto.net/Ads/results.asp?B=2&OfferType=Dealer&broker=',
  platisca: 'https://www.avto.net/Ads/results.asp?B=7&OfferType=Dealer&broker=',
};

const PRICE_SELECTORS = [
  '.GO-Results-Price-Mid',
  '.GO-Results-Price-Mid-Akcija',
  '.GO-Results-Price-TXT-Regular',
  '.GO-Results-Price-TXT-AkcijaCena',
  '.GO-Results-Price',
];

const DEFAULT_USER_DATA: UserData = {
  email: '',
  password: '',
  brokerId: '',
  subscriptionPaidTo: '',
  hdImages: false,
};

const DEFAULT_RENEWAL_STATE: RenewalState = {
  running: false,
  completed: 0,
  total: 0,
  currentAdId: null,
  message: '',
  errors: [],
};

const MAX_DEBUG_LOG_ITEMS = 500;

function makeLogEntry(
  level: LogLevel,
  message: string,
  context: unknown = null,
): DebugLogEntry {
  return {
    ts: new Date().toISOString(),
    level,
    message,
    context,
  };
}

async function getStorageValue<T>(key: string, fallbackValue: T): Promise<T> {
  const data = await chrome.storage.local.get(key);
  return (data[key] as T | undefined) ?? fallbackValue;
}

async function setStorageValue<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

async function appendDebugLog(
  level: LogLevel,
  message: string,
  context: unknown = null,
): Promise<void> {
  const entry = makeLogEntry(level, message, context);
  const current = await getStorageValue<DebugLogEntry[]>('debugLog', []);
  const next = [...current, entry].slice(-MAX_DEBUG_LOG_ITEMS);
  await setStorageValue('debugLog', next);
  chrome.runtime.sendMessage({ type: 'debug-log-updated', payload: entry });

  if (level === 'error') {
    console.error('[AvtonetBot]', message, context ?? '');
  } else if (level === 'warn') {
    console.warn('[AvtonetBot]', message, context ?? '');
  } else {
    console.log('[AvtonetBot]', message, context ?? '');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  return `https://www.avto.net${url.startsWith('/') ? url : `/${url}`}`;
}

function parseAdsFromHtml(html: string): { ads: AdItem[]; nextPageUrl: string | null } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const rows = Array.from(doc.querySelectorAll('.GO-Results-Row'));

  const ads: AdItem[] = rows
    .map((row) => {
      const photoEl = row.querySelector('.GO-Results-Photo');
      if (!photoEl) {
        return null;
      }

      const name = row.querySelector('.GO-Results-Naziv')?.textContent?.trim() ?? '';
      const photoUrl = photoEl.querySelector('img')?.getAttribute('src') ?? '';
      const adUrlRaw = photoEl.querySelector('a')?.getAttribute('href') ?? '';
      const adUrl = normalizeUrl(adUrlRaw);

      if (!adUrl) {
        return null;
      }

      let price = '';
      for (const selector of PRICE_SELECTORS) {
        const value = row.querySelector(selector)?.textContent?.trim();
        if (value) {
          price = value;
          break;
        }
      }

      if (!price || price === 'PRODANO') {
        return null;
      }

      const adId = adUrl.split('ID=')[1]?.split('&')[0] ?? '';

      return {
        name,
        price,
        photoUrl: normalizeUrl(photoUrl) ?? photoUrl,
        adUrl,
        adId,
      };
    })
    .filter((item): item is AdItem => Boolean(item));

  const nextPageLink = doc.querySelector('.GO-Rounded-R a')?.getAttribute('href');

  return {
    ads,
    nextPageUrl: normalizeUrl(nextPageLink),
  };
}

async function fetchActiveAds(adType: AdType, brokerId: string): Promise<AdItem[]> {
  await appendDebugLog('info', 'fetchActiveAds called', {
    adType,
    hasBrokerId: Boolean(brokerId),
  });

  const baseUrl = AVTONET_URLS[adType];
  if (!baseUrl) {
    throw new Error('Neznan tip oglasov.');
  }
  if (!brokerId) {
    throw new Error(
      'Broker ID ni nastavljen. Klikni "Osveži račun" da se prenese iz backenda.',
    );
  }

  let url: string | null = `${baseUrl}${encodeURIComponent(brokerId)}`;
  const collected: AdItem[] = [];
  const visited = new Set<string>();

  while (url && !visited.has(url)) {
    visited.add(url);
    await appendDebugLog('info', 'Fetching ads page', { url });
    const response = await fetch(url, { method: 'GET' });

    if (!response.ok) {
      throw new Error(`Napaka pri nalaganju oglasov (${response.status}).`);
    }

    const html = await response.text();
    await appendDebugLog('info', 'Fetched ads page HTML', {
      url,
      length: html.length,
    });

    const { ads, nextPageUrl } = parseAdsFromHtml(html);
    collected.push(...ads);
    url = nextPageUrl;
  }

  await appendDebugLog('info', 'fetchActiveAds completed', {
    total: collected.length,
  });

  return collected;
}

function waitForTabComplete(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Tab load timeout.'));
    }, 120000);

    function listener(updatedTabId: number, info: { status?: string }): void {
      if (updatedTabId === tabId && info.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function updateRenewalState(partial: Partial<RenewalState>): Promise<void> {
  await appendDebugLog('info', 'Renewal state updated', partial);
  const current = await getStorageValue<RenewalState>(
    'renewalState',
    DEFAULT_RENEWAL_STATE,
  );
  const nextState: RenewalState = { ...current, ...partial };
  await setStorageValue('renewalState', nextState);
  chrome.runtime.sendMessage({ type: 'renewal-state-updated', payload: nextState });
}

async function runRenewalForAd(
  ad: AdItem,
  userData: UserData,
  adType: AdType,
): Promise<void> {
  await appendDebugLog('info', 'runRenewalForAd start', { adId: ad.adId, adType });

  const tab = await chrome.tabs.create({
    url: ad.adUrl,
    active: false,
  });

  if (!tab?.id) {
    throw new Error(`Napaka pri odpiranju zavihka za oglas ${ad.adId}.`);
  }

  try {
    await waitForTabComplete(tab.id);
    await appendDebugLog('info', 'Sending renew message to content script', {
      tabId: tab.id,
      adId: ad.adId,
    });

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'renew-current-ad',
      payload: {
        ad,
        adType,
        email: userData.email,
        password: userData.password,
        hdImages: userData.hdImages,
      },
    });

    if (!response?.ok) {
      await appendDebugLog('error', 'Content script returned error', {
        adId: ad.adId,
        response,
      });
      throw new Error(response?.error ?? 'Neznana napaka pri obnavljanju.');
    }

    await appendDebugLog('info', 'runRenewalForAd success', { adId: ad.adId });
  } finally {
    await chrome.tabs.remove(tab.id);
    await appendDebugLog('info', 'Closed renewal tab', {
      tabId: tab.id,
      adId: ad.adId,
    });
  }
}

async function startRenewal(
  ads: AdItem[],
  pauseMinutes: number,
  adType: AdType,
): Promise<void> {
  await appendDebugLog('info', 'startRenewal called', {
    total: ads.length,
    pauseMinutes,
    adType,
  });

  const userData = await getStorageValue<UserData>('userData', DEFAULT_USER_DATA);

  await updateRenewalState({
    ...DEFAULT_RENEWAL_STATE,
    running: true,
    total: ads.length,
    message: 'Začenjam obnavljanje...',
  });

  for (let index = 0; index < ads.length; index += 1) {
    const ad = ads[index];

    try {
      await updateRenewalState({
        currentAdId: ad.adId,
        message: `Obnavljam oglas ${index + 1}/${ads.length}`,
      });

      await runRenewalForAd(ad, userData, adType);

      await updateRenewalState({
        completed: index + 1,
        message: `Uspešno obnovljen oglas ${index + 1}/${ads.length}`,
      });

      const hasNext = index < ads.length - 1;
      if (hasNext && pauseMinutes > 0) {
        await updateRenewalState({
          message: `Pavza ${pauseMinutes} min pred naslednjim oglasom...`,
        });
        await sleep(pauseMinutes * 60 * 1000);
      }
    } catch (error) {
      await appendDebugLog('error', 'Error while renewing ad', {
        adId: ad.adId,
        error: error instanceof Error ? error.message : String(error),
      });

      const errors = await getStorageValue<RenewalState>(
        'renewalState',
        DEFAULT_RENEWAL_STATE,
      );

      const nextErrors: RenewalError[] = [
        ...errors.errors,
        {
          adId: ad.adId,
          message: error instanceof Error ? error.message : String(error),
        },
      ];

      await updateRenewalState({
        completed: index + 1,
        errors: nextErrors,
      });
    }
  }

  await updateRenewalState({
    running: false,
    currentAdId: null,
    message: 'Obnavljanje zaključeno.',
  });

  await appendDebugLog('info', 'startRenewal finished', { total: ads.length });
}

async function refreshSubscription(): Promise<UserData> {
  await appendDebugLog('info', 'refreshSubscription called');

  const userData = await getStorageValue<UserData>('userData', DEFAULT_USER_DATA);
  if (!userData.email) {
    return userData;
  }

  const response = await fetch(
    `https://avtonet-server.onrender.com/user?email=${encodeURIComponent(userData.email)}`,
  );

  if (!response.ok) {
    throw new Error('Ne morem osvežiti naročnine.');
  }

  const apiData = (await response.json()) as Partial<UserData>;
  const merged: UserData = {
    ...userData,
    subscriptionPaidTo: apiData.subscriptionPaidTo ?? '',
    brokerId: apiData.brokerId ?? userData.brokerId,
    hdImages: Boolean(apiData.hdImages),
  };

  await setStorageValue('userData', merged);
  await appendDebugLog('info', 'refreshSubscription success', {
    brokerId: merged.brokerId,
    hdImages: merged.hdImages,
  });

  return merged;
}

chrome.runtime.onInstalled.addListener(async () => {
  const existingUserData = await getStorageValue<UserData | null>('userData', null);
  if (!existingUserData) {
    await setStorageValue('userData', DEFAULT_USER_DATA);
  }

  await setStorageValue('renewalState', DEFAULT_RENEWAL_STATE);
  await setStorageValue<DebugLogEntry[]>('debugLog', []);
});

chrome.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
  appendDebugLog('info', 'Incoming runtime message', { type: message?.type }).catch(
    () => undefined,
  );

  (async () => {
    if (message.type === 'get-user-data') {
      const userData = await getStorageValue<UserData>('userData', DEFAULT_USER_DATA);
      sendResponse({ ok: true, data: userData });
      return;
    }

    if (message.type === 'save-user-data') {
      const existing = await getStorageValue<UserData>('userData', DEFAULT_USER_DATA);
      const nextUserData: UserData = {
        ...DEFAULT_USER_DATA,
        ...existing,
        ...(message.payload ?? {}),
      };
      await setStorageValue('userData', nextUserData);
      sendResponse({ ok: true, data: nextUserData });
      return;
    }

    if (message.type === 'refresh-subscription') {
      const data = await refreshSubscription();
      sendResponse({ ok: true, data });
      return;
    }

    if (message.type === 'fetch-active-ads') {
      const userData = await getStorageValue<UserData>('userData', DEFAULT_USER_DATA);
      const adType = (message.payload?.adType ?? 'car') as AdType;
      const ads = await fetchActiveAds(adType, userData.brokerId);
      sendResponse({ ok: true, data: ads });
      return;
    }

    if (message.type === 'start-renewal') {
      const payload = message.payload ?? {};
      startRenewal(
        (payload.ads ?? []) as AdItem[],
        Number(payload.pauseMinutes ?? 0),
        (payload.adType ?? 'car') as AdType,
      ).catch(async (error: unknown) => {
        await updateRenewalState({
          running: false,
          message: error instanceof Error ? error.message : String(error),
        });
      });
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'get-renewal-state') {
      const renewalState = await getStorageValue<RenewalState>(
        'renewalState',
        DEFAULT_RENEWAL_STATE,
      );
      sendResponse({ ok: true, data: renewalState });
      return;
    }

    if (message.type === 'get-debug-log') {
      const debugLog = await getStorageValue<DebugLogEntry[]>('debugLog', []);
      sendResponse({ ok: true, data: debugLog });
      return;
    }

    if (message.type === 'clear-debug-log') {
      await setStorageValue<DebugLogEntry[]>('debugLog', []);
      sendResponse({ ok: true, data: [] });
      return;
    }

    sendResponse({ ok: false, error: 'Unknown message type.' });
  })().catch(async (error: unknown) => {
    await appendDebugLog('error', 'Runtime message handler failed', {
      type: message?.type,
      error: error instanceof Error ? error.message : String(error),
    });

    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return true;
});
