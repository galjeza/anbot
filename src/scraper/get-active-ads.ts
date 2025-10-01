import { setupBrowser } from './utils/browser-utils.js';
import { AVTONET_URLS, AdTypeKey } from './utils/constants';

export interface ActiveAd {
  name: string;
  price: string;
  photoUrl: string;
  adUrl: string;
  adId: string;
}

export async function fetchActiveAds(
  brokerId: string,
  adType: AdTypeKey,
): Promise<ActiveAd[]> {
  const url = `${AVTONET_URLS[adType]}${brokerId}`;
  const browser = await setupBrowser();
  const [page] = await browser.pages();
  await page.goto(url);

  const RESULTS_ROW_SELECTOR = '.GO-Results-Row';
  const NEXT_BUTTON_SELECTOR = '.GO-Rounded-R';

  await page.waitForSelector(RESULTS_ROW_SELECTOR);
  let resultRows = await page.$$(RESULTS_ROW_SELECTOR);
  const adData: ActiveAd[] = [];

  while (true) {
    for (const adElement of resultRows) {
      try {
        const photoElement = await adElement.$('.GO-Results-Photo');
        if (!photoElement) continue;

        const [name, price, photoUrl, adUrl] = await Promise.all([
          adElement.$eval('.GO-Results-Naziv', (el) =>
            (el as HTMLElement).innerText.trim(),
          ),
          adElement.$eval('.GO-Results-Price-Mid', (el) =>
            (el as HTMLElement).innerText.trim(),
          ),
          photoElement.$eval('img', (el) => el.getAttribute('src')),
          photoElement.$eval('a', (el) => el.getAttribute('href')),
        ]);

        if (!adUrl) continue;
        const adId = adUrl.split('=')[1] ?? '';
        if (price === 'PRODANO') continue;

        adData.push({ name, price, photoUrl: photoUrl ?? '', adUrl, adId });
      } catch {
        continue;
      }
    }

    const nextPageButton = await page.$(NEXT_BUTTON_SELECTOR);
    if (!nextPageButton) break;

    const isDisabled = await page.evaluate(
      (el) => el.classList.contains('disabled'),
      nextPageButton,
    );
    if (isDisabled) break;

    const nextPageUrl = await page.evaluate(
      (el) => el.querySelector('a')?.href,
      nextPageButton,
    );
    if (!nextPageUrl) break;

    await page.goto(nextPageUrl);
    await page.waitForSelector(RESULTS_ROW_SELECTOR);
    resultRows = await page.$$(RESULTS_ROW_SELECTOR);
  }

  await browser.close();
  return adData;
}
