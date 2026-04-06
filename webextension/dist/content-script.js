"use strict";
const PRICE_SELECTORS = [
    '.GO-Results-Price-Mid',
    '.GO-Results-Price-Mid-Akcija',
    '.GO-Results-Price-TXT-Regular',
    '.GO-Results-Price-TXT-AkcijaCena',
    '.GO-Results-Price',
];
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function normalize(text) {
    return (text ?? '').trim().toLowerCase();
}
function findClickableByText(candidates, textMatchers) {
    const elements = Array.from(document.querySelectorAll(candidates));
    for (const element of elements) {
        const text = normalize(element.textContent);
        if (!text) {
            continue;
        }
        const matches = textMatchers.some((matcher) => text.includes(matcher));
        if (matches) {
            return element;
        }
    }
    return null;
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
function scrapeActiveAdsPage() {
    const rows = Array.from(document.querySelectorAll('.GO-Results-Row'));
    const ads = rows
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
        .filter((item) => Boolean(item));
    const nextPageLink = document
        .querySelector('.GO-Rounded-R a')
        ?.getAttribute('href');
    return {
        ads,
        nextPageUrl: normalizeUrl(nextPageLink),
    };
}
async function ensureLoggedIn(email, password) {
    const emailInput = document.querySelector('input[type="email"], input[name*="mail" i]');
    const passwordInput = document.querySelector('input[type="password"]');
    if (!emailInput || !passwordInput) {
        return;
    }
    emailInput.focus();
    emailInput.value = email;
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    passwordInput.focus();
    passwordInput.value = password;
    passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    const submitButton = document.querySelector('button[type="submit"], input[type="submit"]') ??
        findClickableByText('button, a, input[type="button"]', ['prijava', 'login']);
    if (submitButton) {
        submitButton.click();
        await sleep(6000);
    }
}
async function clickRenewButton() {
    const renewButton = findClickableByText('button, a', [
        'obnovi',
        'podaljšaj',
        'ponovno objavi',
        'uredi oglas',
    ]) ?? document.querySelector('a[href*="OddajaOglasa.asp" i]');
    if (!renewButton) {
        throw new Error('Ne najdem gumba za obnovo oglasa na strani.');
    }
    renewButton.click();
    await sleep(5000);
}
async function publishIfPossible() {
    const publishButton = findClickableByText('button, a, input[type="submit"]', [
        'objavi',
        'shrani',
        'potrdi',
        'nadaljuj',
    ]) ?? document.querySelector('input[type="submit"]');
    if (publishButton) {
        publishButton.click();
        await sleep(5000);
    }
}
async function renewCurrentAd(payload) {
    const { email, password } = payload;
    await ensureLoggedIn(email, password);
    await clickRenewButton();
    for (let i = 0; i < 3; i += 1) {
        await publishIfPossible();
        await sleep(2000);
    }
    return { ok: true };
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'scrape-active-ads-page') {
        sendResponse(scrapeActiveAdsPage());
        return false;
    }
    if (message.type !== 'renew-current-ad') {
        return false;
    }
    renewCurrentAd((message.payload ?? {}))
        .then((result) => sendResponse(result))
        .catch((error) => {
        sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        });
    });
    return true;
});
