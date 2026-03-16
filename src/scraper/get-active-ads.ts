import { setupBrowser } from './utils/browser-utils.js';
import { AVTONET_URLS, AdTypeKey } from './utils/constants';

export interface ActiveAd {
  name: string;
  price: string;
  photoUrl: string;
  adUrl: string;
  adId: string;
}

const RESULTS_ROW_SELECTOR = '.GO-Results-Row';
const NEXT_BUTTON_SELECTOR = '.GO-Rounded-R';

const PRICE_SELECTORS = [
  '.GO-Results-Price-Mid',
  '.GO-Results-Price-Mid-Akcija',
  '.GO-Results-Price-TXT-Regular',
  '.GO-Results-Price-TXT-AkcijaCena',
  '.GO-Results-Price',
];

export async function fetchActiveAds(
  brokerId: string,
  adType: AdTypeKey,
): Promise<ActiveAd[]> {
  const url = `${AVTONET_URLS[adType]}${brokerId}`;
  const { browser, release } = await setupBrowser();

  try {
    const [page] = await browser.pages();

    await page.goto(url, {
      waitUntil: 'domcontentloaded', // much faster than default networkidle2
    });

    const adData: ActiveAd[] = [];

    while (true) {
      await page.waitForSelector(RESULTS_ROW_SELECTOR, { timeout: 15_000 });
      await page.waitForFunction(
        (selector) => {
          const images = Array.from(
            document.querySelectorAll(`${selector} img`),
          );
          return images.some(
            (img) =>
              img.getAttribute('src') &&
              !img.getAttribute('src')?.startsWith('data:'),
          );
        },
        { timeout: 30_000 },
        RESULTS_ROW_SELECTOR,
      );

      // ✅ Single round-trip — extract ALL ad data for the entire page at once
      const pageAds = await page.evaluate(
        (rowSelector, priceSelectors) => {
          const rows = document.querySelectorAll(rowSelector);
          const results: Array<{
            name: string;
            price: string;
            photoUrl: string;
            adUrl: string;
          }> = [];

          for (const row of Array.from(rows)) {
            const photoEl = row.querySelector('.GO-Results-Photo');
            if (!photoEl) continue;

            const name =
              (
                row.querySelector('.GO-Results-Naziv') as HTMLElement
              )?.innerText.trim() ?? '';

            const photoUrl =
              photoEl.querySelector('img')?.getAttribute('src') ?? '';
            const adUrl =
              photoEl.querySelector('a')?.getAttribute('href') ?? '';

            if (!adUrl) continue;

            let price = '';
            for (const sel of priceSelectors) {
              const node = row.querySelector(sel) as HTMLElement | null;
              if (node?.innerText.trim()) {
                price = node.innerText.trim();
                break;
              }
            }

            if (!price || price === 'PRODANO') continue;

            results.push({ name, price, photoUrl, adUrl });
          }

          return results;
        },
        RESULTS_ROW_SELECTOR,
        PRICE_SELECTORS,
      );

      for (const ad of pageAds) {
        adData.push({
          ...ad,
          adId: ad.adUrl.split('=')[1] ?? '',
        });
      }

      // Check for next page — also single evaluate
      const nextPageUrl = await page.evaluate((selector) => {
        const btn = document.querySelector(selector);
        if (!btn || btn.classList.contains('disabled')) return null;
        return btn.querySelector('a')?.href ?? null;
      }, NEXT_BUTTON_SELECTOR);

      if (!nextPageUrl) break;

      await page.goto(nextPageUrl, { waitUntil: 'domcontentloaded' });
    }

    return adData;
  } finally {
    await release(); // always runs, even on throw
  }
}
