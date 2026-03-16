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
import { wait } from '../utils/utils.js';

const SLOW_TIMEOUT_MS = 15 * 60 * 1000;

export const createNewAd = async (browser, carData, adType) => {
  console.log('[createNewAd] Start', { adType, fields: carData.length });
  const modelRelatedFields = carData.filter(
    (data) =>
      data.name.toLowerCase().includes('model') ||
      data.name.toLowerCase().includes('tip') ||
      data.name.toLowerCase().includes('type'),
  );
  console.log('[createNewAd] Model-related fields', {
    count: modelRelatedFields.length,
  });

  const newAdUrl = getNewAdUrl(adType);
  console.log('[createNewAd] New ad URL', { newAdUrl });

  const [page] = await browser.pages();
  page.setDefaultTimeout(SLOW_TIMEOUT_MS);
  page.setDefaultNavigationTimeout(SLOW_TIMEOUT_MS);
  await page.goto(newAdUrl);
  if (adType !== 'platisca') {
    console.log('[createNewAd] Waiting for brand selector');
    await page.waitForSelector('select[name=znamka]', { timeout: 0 });

    await selectBrand(page, carData, adType);
    console.log('Selected brand');

    const carModel = resolveModelValue(carData, adType, modelRelatedFields);
    console.log('Resolved model value: ', carModel);

    await selectModel(page, carModel);
    console.log('[createNewAd] Selected model');

    await page.select(
      'select[name=oblika]',
      carData.find((data) => data.name === 'oblika').value,
    );
    console.log('[createNewAd] Selected body type');

    await setRegistrationMonthYear(page, carData);
    console.log('[createNewAd] Set registration month/year');

    await setFuelType(page, carData);
    console.log('[createNewAd] Set fuel type');
    await page.click('button[name="potrdi"]');
    console.log('[createNewAd] Confirmed step 1');

    await wait(5);

    if (adType === 'car') {
      await page.waitForSelector('.supurl', {
        timeout: 0,
      });

      await page.click('.supurl');
      console.log('[createNewAd] Clicked supurl');
    }
  } else {
    console.log('[createNewAd] Skipping brand/model for platisca');
  }

  await page.waitForSelector('input[name="cena"], input[name="cenaEURO"]', {
    visible: true,
    timeout: SLOW_TIMEOUT_MS,
  });
  console.log('Cena field found');

  await fillWysiwygOpis(page, carData);
  console.log('Filled wysiwyg opis');

  await fillCheckboxesFromData(page, carData);
  console.log('Filled checkboxes');

  await fillInputsFromData(page, carData);
  console.log('Filled inputs');

  await fillSelectsFromData(page, carData);
  console.log('Filled selects');

  await fillTextareasFromData(page, carData);
  console.log('Filled textareas');

  const vinObjaviField = carData.find((data) => data.name === 'VINobjavi');
  if (adType === 'car' && vinObjaviField) {
    const shouldBeChecked = vinObjaviField.value === '1';
    const isChecked = await page.$eval('#VINobjavi', (el) => el && el.checked);

    if (shouldBeChecked !== isChecked) {
      console.log('[createNewAd] Toggling VIN visibility', {
        shouldBeChecked,
        isChecked,
      });
      await page.click('#VINobjavi');
    } else {
      console.log('[createNewAd] VIN visibility already correct', {
        shouldBeChecked,
      });
    }
  }

  await solveCaptcha(page);
  console.log('Captcha solved');

  await page.click('button[name="EDITAD"]');
  console.log('[createNewAd] Submitted new ad');
};
