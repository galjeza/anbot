import { setupBrowser } from './utils/browser-utils.js';
import { AVTONET_BROKER_URL } from './utils/constants.js';
import { saveList } from './utils/utils.js';

export async function fetchActiveAds(brokerId) {
  console.log(`Starting fetchActiveAds for brokerId: ${brokerId}`); // Log at the start
  const browser = await setupBrowser();
  const [page] = await browser.pages();

  try {
    console.log(`Navigating to URL: ${AVTONET_BROKER_URL + brokerId}`); // Log before navigating
    await page.goto(AVTONET_BROKER_URL + brokerId);
    console.log(`Waiting for selector '.GO-Results-Row'`); // Log waiting for selector
    await page.waitForSelector('.GO-Results-Row');
    let adElements = await page.$$('.GO-Results-Row');
    const adData = [];
    console.log(`Found ${adElements.length} ad elements`); // Log number of ad elements found

    let scrapePage = true;

    while (scrapePage) {
      console.log(`Scraping page...`); // Log the start of page scraping
      for (const adElement of adElements) {
        try {
          const tableRows = await adElement.$$('.GO-Results-Data-Top tr'); // This could be logged if necessary
          const photoElement = await adElement.$('.GO-Results-Photo');

          if (!photoElement) {
            console.log('No photo found for ad. Skipping.'); // Log if no photo found
            continue;
          }
          const [name, price, photoUrl, adUrl] = await Promise.all([
            adElement.$eval('.GO-Results-Naziv', (el) => el.innerText.trim()),
            adElement.$eval('.GO-Results-Price-Mid', (el) =>
              el.innerText.trim(),
            ),
            photoElement.$eval('img', (el) => el.getAttribute('src')),
            photoElement.$eval('a', (el) => el.getAttribute('href')),
          ]);

          console.log(`Scraped ad: ${name}`); // Log each ad scraped

          const adId = adUrl.split('=')[1];
          if (price === 'PRODANO') {
            console.log(`Ad ${name} is marked as sold. Skipping.`); // Log if ad is marked as sold
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
        console.log(`Next page button found. Checking if it's disabled.`); // Log next page button found
        const disabled = await page.evaluate(
          (el) => el.classList.contains('disabled'),
          nextPageButton,
        );
        if (disabled) {
          console.log(`Next page button is disabled. Ending scrape.`); // Log next page button disabled
          scrapePage = false;
          break;
        }
        const nextPageUrl = await page.evaluate(
          (el) => el.querySelector('a').href,
          nextPageButton,
        );
        console.log(`Navigating to next page: ${nextPageUrl}`); // Log navigating to next page
        await page.goto(nextPageUrl);
        await page.waitForSelector('.GO-Results-Row');
        adElements = await page.$$('.GO-Results-Row');
      } else {
        console.log(`No next page button found. Ending scrape.`); // Log ending scrape if no next button found
        scrapePage = false;
      }
    }
    console.log(`Scraping complete. Total ads scraped: ${adData.length}`); // Log scraping completion
    console.log('Ad data:', adData); // This could potentially log a lot of data
    return adData;
  } catch (error) {
    await saveList(error, 'error.json');
    console.error('Error occurred:', error); // Log error
    return [];
  } finally {
    console.log(`Closing browser.`); // Log browser closing
    await browser.close();
  }
}
