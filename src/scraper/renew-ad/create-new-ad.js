import { wait } from '../utils/utils.js';
import { solveCaptcha } from './solve-captcha.js';
import { getNewAdUrl } from './get-new-ad-url.js';
import {
  selectBrand,
  resolveModelValue,
  selectModel,
} from './select-brand-and-model.js';
import { setRegistrationMonthYear } from './set-registration-values.js';
import { setFuelType } from './set-fuel-type.js';
import {
  fillWysiwygOpis,
  fillCheckboxesFromData,
  fillInputsFromData,
  fillSelectsFromData,
  fillTextareasFromData,
} from './fill-form-fields.js';

export const createNewAd = async (browser, carData, adType) => {
  console.log('Ad type', adType);

  // Check for specific fields that might be missing
  const znamkaField = carData.find((data) => data.name === 'znamka');
  const modelField = carData.find((data) => data.name === 'model');
  const modelTEMPField = carData.find((data) => data.name === 'modelTEMP');

  const brandRelatedFields = carData.filter(
    (data) =>
      data.name.toLowerCase().includes('znamka') ||
      data.name.toLowerCase().includes('brand') ||
      data.name.toLowerCase().includes('make'),
  );

  const modelRelatedFields = carData.filter(
    (data) =>
      data.name.toLowerCase().includes('model') ||
      data.name.toLowerCase().includes('tip') ||
      data.name.toLowerCase().includes('type'),
  );

  const newAdUrl = getNewAdUrl(adType);

  try {
    const [page] = await browser.pages();
    // go to the new ad page
    await page.goto(newAdUrl);
    await page.waitForSelector('select[name=znamka]', { timeout: 0 });

    await selectBrand(page, carData, adType);

    const carModel = resolveModelValue(carData, adType, modelRelatedFields);

    console.log('Selected car model:', carModel);

    await selectModel(page, carModel);

    await page.select(
      'select[name=oblika]',
      carData.find((data) => data.name === 'oblika').value,
    );

    await setRegistrationMonthYear(page, carData);

    await setFuelType(page, carData);
    console.log('First page done');
    await page.click('button[name="potrdi"]');

    console.log('GOT TO #0');
    if (adType === 'car') {
      await page.waitForSelector('.supurl', {
        timeout: 0,
      });

      await page.click('.supurl');
    }

    await page.waitForSelector('input[name=cena]', { timeout: 0 });

    await wait(2);
    await fillWysiwygOpis(page, carData);

    await fillCheckboxesFromData(page, carData);

    await fillInputsFromData(page, carData);

    await fillSelectsFromData(page, carData);

    await fillTextareasFromData(page, carData);

    if (adType === 'car') {
      if (carData.find((data) => data.name === 'VINobjavi').value === '1') {
        await page.click('#VINobjavi');
      }
    }

    await solveCaptcha(page);

    await wait(2);
    await page.click('button[name="EDITAD"]');
  } catch (e) {
    console.log(e);
    throw e;
  }
};
