const AVTONET_URLS = {
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
const DEFAULT_USER_DATA = {
    email: '',
    password: '',
    brokerId: '',
    subscriptionPaidTo: '',
    hdImages: false,
};
const DEFAULT_RENEWAL_STATE = {
    running: false,
    completed: 0,
    total: 0,
    currentAdId: null,
    message: '',
    errors: [],
};
const MAX_DEBUG_LOG_ITEMS = 500;
function makeLogEntry(level, message, context = null) {
    return {
        ts: new Date().toISOString(),
        level,
        message,
        context,
    };
}
async function getStorageValue(key, fallbackValue) {
    const data = await chrome.storage.local.get(key);
    return data[key] ?? fallbackValue;
}
async function setStorageValue(key, value) {
    await chrome.storage.local.set({ [key]: value });
}
async function appendDebugLog(level, message, context = null) {
    const entry = makeLogEntry(level, message, context);
    const current = await getStorageValue('debugLog', []);
    const next = [...current, entry].slice(-MAX_DEBUG_LOG_ITEMS);
    await setStorageValue('debugLog', next);
    chrome.runtime.sendMessage({ type: 'debug-log-updated', payload: entry });
    if (level === 'error') {
        console.error('[AvtonetBot]', message, context ?? '');
    }
    else if (level === 'warn') {
        console.warn('[AvtonetBot]', message, context ?? '');
    }
    else {
        console.log('[AvtonetBot]', message, context ?? '');
    }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function normalizeUrl(url) {
    if (!url) {
        return null;
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    return `https://www.avto.net${url.startsWith('/') ? url : `/${url}`}`;
}
async function fetchActiveAds(adType, brokerId) {
    await appendDebugLog('info', 'fetchActiveAds called', {
        adType,
        hasBrokerId: Boolean(brokerId),
    });
    const baseUrl = AVTONET_URLS[adType];
    if (!baseUrl) {
        throw new Error('Neznan tip oglasov.');
    }
    if (!brokerId) {
        throw new Error('Broker ID ni nastavljen. Klikni "Osveži račun" da se prenese iz backenda.');
    }
    let url = `${baseUrl}${encodeURIComponent(brokerId)}`;
    const collected = [];
    const visited = new Set();
    const tab = await chrome.tabs.create({
        url,
        active: true,
    });
    if (!tab?.id) {
        throw new Error('Ne morem odpreti zavihka za branje oglasov.');
    }
    await appendDebugLog('info', 'Opened browser tab for active ads scraping', {
        tabId: tab.id,
        url,
    });
    try {
        while (url && !visited.has(url)) {
            visited.add(url);
            await appendDebugLog('info', 'Scraping ads page in content script', { url });
            await waitForTabComplete(tab.id);
            const pageResult = (await chrome.tabs.sendMessage(tab.id, {
                type: 'scrape-active-ads-page',
            }));
            if (!pageResult) {
                throw new Error('Ne morem prebrati oglasov iz strani.');
            }
            collected.push(...(pageResult.ads ?? []));
            url = pageResult.nextPageUrl;
            if (url && !visited.has(url)) {
                await chrome.tabs.update(tab.id, { url });
            }
        }
        await appendDebugLog('info', 'fetchActiveAds completed', {
            total: collected.length,
        });
        return collected;
    }
    finally {
        await chrome.tabs.remove(tab.id);
    }
}
function waitForTabComplete(tabId) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            reject(new Error('Tab load timeout.'));
        }, 120000);
        function listener(updatedTabId, info) {
            if (updatedTabId === tabId && info.status === 'complete') {
                clearTimeout(timeout);
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }
        }
        chrome.tabs.onUpdated.addListener(listener);
    });
}
async function updateRenewalState(partial) {
    await appendDebugLog('info', 'Renewal state updated', partial);
    const current = await getStorageValue('renewalState', DEFAULT_RENEWAL_STATE);
    const nextState = { ...current, ...partial };
    await setStorageValue('renewalState', nextState);
    chrome.runtime.sendMessage({ type: 'renewal-state-updated', payload: nextState });
}
async function runRenewalForAd(ad, userData, adType) {
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
    }
    finally {
        await chrome.tabs.remove(tab.id);
        await appendDebugLog('info', 'Closed renewal tab', {
            tabId: tab.id,
            adId: ad.adId,
        });
    }
}
async function startRenewal(ads, pauseMinutes, adType) {
    await appendDebugLog('info', 'startRenewal called', {
        total: ads.length,
        pauseMinutes,
        adType,
    });
    const userData = await getStorageValue('userData', DEFAULT_USER_DATA);
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
        }
        catch (error) {
            await appendDebugLog('error', 'Error while renewing ad', {
                adId: ad.adId,
                error: error instanceof Error ? error.message : String(error),
            });
            const errors = await getStorageValue('renewalState', DEFAULT_RENEWAL_STATE);
            const nextErrors = [
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
async function refreshSubscription() {
    await appendDebugLog('info', 'refreshSubscription called');
    const userData = await getStorageValue('userData', DEFAULT_USER_DATA);
    if (!userData.email) {
        return userData;
    }
    const response = await fetch(`https://avtonet-server.onrender.com/user?email=${encodeURIComponent(userData.email)}`);
    if (!response.ok) {
        throw new Error('Ne morem osvežiti naročnine.');
    }
    const apiData = (await response.json());
    const merged = {
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
    const existingUserData = await getStorageValue('userData', null);
    if (!existingUserData) {
        await setStorageValue('userData', DEFAULT_USER_DATA);
    }
    await setStorageValue('renewalState', DEFAULT_RENEWAL_STATE);
    await setStorageValue('debugLog', []);
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    (async () => {
        if (message.type === 'get-user-data') {
            const userData = await getStorageValue('userData', DEFAULT_USER_DATA);
            sendResponse({ ok: true, data: userData });
            return;
        }
        if (message.type === 'save-user-data') {
            const existing = await getStorageValue('userData', DEFAULT_USER_DATA);
            const nextUserData = {
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
            const userData = await getStorageValue('userData', DEFAULT_USER_DATA);
            const adType = (message.payload?.adType ?? 'car');
            const ads = await fetchActiveAds(adType, userData.brokerId);
            sendResponse({ ok: true, data: ads });
            return;
        }
        if (message.type === 'start-renewal') {
            const payload = message.payload ?? {};
            startRenewal((payload.ads ?? []), Number(payload.pauseMinutes ?? 0), (payload.adType ?? 'car')).catch(async (error) => {
                await updateRenewalState({
                    running: false,
                    message: error instanceof Error ? error.message : String(error),
                });
            });
            sendResponse({ ok: true });
            return;
        }
        if (message.type === 'get-renewal-state') {
            const renewalState = await getStorageValue('renewalState', DEFAULT_RENEWAL_STATE);
            sendResponse({ ok: true, data: renewalState });
            return;
        }
        if (message.type === 'get-debug-log') {
            const debugLog = await getStorageValue('debugLog', []);
            sendResponse({ ok: true, data: debugLog });
            return;
        }
        if (message.type === 'clear-debug-log') {
            await setStorageValue('debugLog', []);
            sendResponse({ ok: true, data: [] });
            return;
        }
        sendResponse({ ok: false, error: 'Unknown message type.' });
    })().catch(async (error) => {
        await appendDebugLog('error', 'Runtime message handler failed', {
            type: message?.type,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        });
    });
    return true;
});
export {};
