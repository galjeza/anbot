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
  let pageIndex = 1;
  let rowIndex = 0;

  while (true) {
    console.log(
      `[fetchActiveAds] page ${pageIndex}: ${resultRows.length} result rows`,
    );
    for (const adElement of resultRows) {
      rowIndex += 1;
      console.log(
        `[fetchActiveAds] inspecting row ${rowIndex} on page ${pageIndex}`,
      );
      try {
        const photoElement = await adElement.$('.GO-Results-Photo');
        if (!photoElement) {
          console.log(
            `[fetchActiveAds] skip row ${rowIndex}: missing photo element`,
          );
          continue;
        }

        const [name, photoUrl, adUrl] = await Promise.all([
          adElement.$eval('.GO-Results-Naziv', (el) =>
            (el as HTMLElement).innerText.trim(),
          ),
          photoElement.$eval('img', (el) => el.getAttribute('src')),
          photoElement.$eval('a', (el) => el.getAttribute('href')),
        ]);

        const priceSelectors = [
          '.GO-Results-Price-Mid',
          '.GO-Results-Price-Mid-Akcija',
          '.GO-Results-Price-TXT-Regular',
          '.GO-Results-Price-TXT-AkcijaCena',
          '.GO-Results-Price',
        ];

        const { priceText, priceSelector } = await adElement.evaluate(
          (el, selectors) => {
            for (const selector of selectors) {
              const node = el.querySelector(selector);
              if (!node) continue;
              const text = (node as HTMLElement).innerText.trim();
              if (text) return { priceText: text, priceSelector: selector };
            }
            return { priceText: '', priceSelector: '' };
          },
          priceSelectors,
        );

        const price = priceText;
        if (!price) {
          const priceDebug = await adElement.evaluate((el) => {
            const priceNodes = Array.from(
              el.querySelectorAll('[class*="Price"]'),
            ).map((node) => ({
              className: (node as HTMLElement).className,
              text: (node as HTMLElement).innerText.trim(),
            }));
            const textSnippet = (el as HTMLElement).innerText
              .trim()
              .slice(0, 200);
            const htmlSnippet = el.outerHTML.slice(0, 500);
            return { priceNodes, textSnippet, htmlSnippet };
          });

          console.log(
            `[fetchActiveAds] row ${rowIndex} missing price selectors`,
            priceDebug,
          );
        } else if (priceSelector && priceSelector !== '.GO-Results-Price-Mid') {
          console.log(
            `[fetchActiveAds] row ${rowIndex} using fallback price selector`,
            priceSelector,
          );
        }

        console.log(`[fetchActiveAds] parsed row ${rowIndex}`, {
          name,
          price,
          adUrl,
          photoUrl,
        });

        if (!price) {
          console.log(`[fetchActiveAds] skip row ${rowIndex}: missing price`);
          continue;
        }

        if (!adUrl) {
          console.log(`[fetchActiveAds] skip row ${rowIndex}: missing adUrl`);
          continue;
        }
        const adId = adUrl.split('=')[1] ?? '';
        if (price === 'PRODANO') {
          console.log(`[fetchActiveAds] skip row ${rowIndex}: marked PRODANO`);
          continue;
        }

        adData.push({ name, price, photoUrl: photoUrl ?? '', adUrl, adId });
        console.log(`[fetchActiveAds] added row ${rowIndex}: adId=${adId}`);
      } catch (error) {
        console.log(
          `[fetchActiveAds] error row ${rowIndex} on page ${pageIndex}`,
          error,
        );
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

    console.log(
      `[fetchActiveAds] navigating from page ${pageIndex} to next page`,
      nextPageUrl,
    );
    await page.goto(nextPageUrl);
    await page.waitForSelector(RESULTS_ROW_SELECTOR);
    resultRows = await page.$$(RESULTS_ROW_SELECTOR);
    pageIndex += 1;
  }

  await browser.close();
  return adData;
}
