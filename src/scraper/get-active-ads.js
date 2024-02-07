import {setupBrowser} from './utils/browser-utils.js';
import {AVTONET_BROKER_URL} from './utils/constants.js';

export async function fetchActiveAds(brokerId) {
	const browser = await setupBrowser();
	const page = await browser.newPage();

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

				const [
					name,
					firstRegistrationYear,
					mileage,
					fuel,
					transmission,
					engine,
					price,
					photoUrl,
					adUrl,
				] = await Promise.all([
					adElement.$eval('.GO-Results-Naziv', el => el.innerText.trim()),
					tableRows[0].$eval('td:nth-child(2)', el => el.innerText.trim()),
					tableRows[1].$eval('td:nth-child(2)', el => el.innerText.trim()),
					tableRows[2].$eval('td:nth-child(2)', el => el.innerText.trim()),
					tableRows[3].$eval('td:nth-child(2)', el => el.innerText.trim()),
					tableRows[4].$eval('td:nth-child(2)', el => el.innerText.trim()),
					adElement.$eval('.GO-Results-Price-Mid', el => el.innerText.trim()),
					photoElement.$eval('img', el => el.getAttribute('src')),
					photoElement.$eval('a', el => el.getAttribute('href')),
				]);

				const adId = adUrl.split('=')[1];
				if (price === 'PRODANO') continue;

				adData.push({
					name,
					firstRegistrationYear,
					mileage,
					fuel,
					transmission,
					engine,
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
					el => el.classList.contains('disabled'),
					nextPageButton,
				);
				if (disabled) {
					scrapePage = false;
					break;
				}
				const nextPageUrl = await page.evaluate(
					el => el.querySelector('a').href,
					nextPageButton,
				);
				await page.goto(nextPageUrl);
				await page.waitForSelector('.GO-Results-Row');
				adElements = await page.$$('.GO-Results-Row');
			} else {
				scrapePage = false;
			}
		}

		return adData;
	} catch (error) {
		console.error('Error occurred:', error);
		return [];
	} finally {
		await browser.close();
	}
}
