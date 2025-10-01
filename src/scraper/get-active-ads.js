import { setupBrowser } from './utils/browser-utils.js';
import { AVTONET_URLS } from './utils/constants.js';

export async function fetchActiveAds(brokerId, adType) {
  const url = AVTONET_URLS[adType] + brokerId;
  const browser = await setupBrowser();
  const [page] = await browser.pages();
  await page.goto(url);

  await page.waitForSelector('.GO-Results-Row');
  let adElements = await page.$$('.GO-Results-Row');
  const adData = [];

  let scrapePage = true;

  while (scrapePage) {
    for (const adElement of adElements) {
      try {
        const tableRows = await adElement.$$('.GO-Results-Data-Top tr');
        const photoElement = await adElement.$('.GO-Results-Photo');

        if (!photoElement) {
          continue;
        }
        const [name, price, photoUrl, adUrl] = await Promise.all([
          adElement.$eval('.GO-Results-Naziv', (el) => el.innerText.trim()),
          adElement.$eval('.GO-Results-Price-Mid', (el) => el.innerText.trim()),
          photoElement.$eval('img', (el) => el.getAttribute('src')),
          photoElement.$eval('a', (el) => el.getAttribute('href')),
        ]);

        const adId = adUrl.split('=')[1];
        if (price === 'PRODANO') {
          continue;
        }

        adData.push({
          name,
          price,
          photoUrl,
          adUrl,
          adId,
        });
      } catch (error) {
        continue;
      }
    }
    const nextPageButton = await page.$('.GO-Rounded-R');
    if (nextPageButton) {
      const disabled = await page.evaluate(
        (el) => el.classList.contains('disabled'),
        nextPageButton,
      );
      if (disabled) {
        scrapePage = false;
        break;
      }
      const nextPageUrl = await page.evaluate(
        (el) => el.querySelector('a').href,
        nextPageButton,
      );

      await page.goto(nextPageUrl);
      await page.waitForSelector('.GO-Results-Row');
      adElements = await page.$$('.GO-Results-Row');
    } else {
      scrapePage = false;
    }
  }

  await browser.close();
  return adData;
}
