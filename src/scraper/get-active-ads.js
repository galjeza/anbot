import { setupBrowser } from './utils/browser-utils.js';
import { AVTONET_BROKER_URL } from './utils/constants.js';
import { saveList } from './utils/utils.js';

export async function fetchActiveAds(brokerId) {
  const browser = await setupBrowser();
  const [page] = await browser.pages();

  try {
    await page.goto(AVTONET_BROKER_URL + brokerId);
    await page.waitForSelector('.GO-Results-Row');
    let adElements = await page.$$('.GO-Results-Row');
    const adData = [];

    let scrapePage = true;

    while (scrapePage) {
      for (const adElement of adElements) {
        const tableRows = await adElement.$$('.GO-Results-Data-Top tr');
        const photoElement = await adElement.$('.GO-Results-Photo');

        const [name, price, photoUrl, adUrl] = await Promise.all([
          adElement.$eval('.GO-Results-Naziv', (el) => el.innerText.trim()),
          adElement.$eval('.GO-Results-Price-Mid', (el) => el.innerText.trim()),
          photoElement.$eval('img', (el) => el.getAttribute('src')),
          photoElement.$eval('a', (el) => el.getAttribute('href')),
        ]);

        const adId = adUrl.split('=')[1];
        if (price === 'PRODANO') continue;

        adData.push({
          name,
          price,
          photoUrl,
          adUrl,
          adId,
        });
      }
      const nextPageButton = await page.$('.GO-Rounded-R');
      if (nextPageButton) {
        // check if the nextpagebutton also has class disabled
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
    console.log('Ad data:', adData);
    return adData;
  } catch (error) {
    await saveList(error, 'error.json');
    console.error('Error occurred:', error);
    return [];
  } finally {
    await browser.close();
  }
}
