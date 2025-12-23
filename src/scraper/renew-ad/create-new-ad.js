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
  const modelRelatedFields = carData.filter(
    (data) =>
      data.name.toLowerCase().includes('model') ||
      data.name.toLowerCase().includes('tip') ||
      data.name.toLowerCase().includes('type'),
  );

  const newAdUrl = getNewAdUrl(adType);

  const [page] = await browser.pages();
  await page.goto(newAdUrl);
  if (adType !== 'platisca') {
    await page.waitForSelector('select[name=znamka]', { timeout: 0 });

    await selectBrand(page, carData, adType);
    console.log('Selected brand');

    const carModel = resolveModelValue(carData, adType, modelRelatedFields);
    console.log('Resolved model value: ', carModel);

    await selectModel(page, carModel);

    await page.select(
      'select[name=oblika]',
      carData.find((data) => data.name === 'oblika').value,
    );

    await setRegistrationMonthYear(page, carData);

    await setFuelType(page, carData);
    await page.click('button[name="potrdi"]');

    if (adType === 'car') {
      await page.waitForSelector('.supurl', {
        timeout: 0,
      });

      await page.click('.supurl');
    }
  }

  await page.waitForSelector('input[name="cena"], input[name="cenaEURO"]', {
    visible: true,
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
    const isChecked = await page.$eval(
      '#VINobjavi',
      (el) => el && el.checked,
    );

    if (shouldBeChecked !== isChecked) {
      await page.click('#VINobjavi');
    }
  }

  await solveCaptcha(page);
  console.log('Captcha solved');

  await page.click('button[name="EDITAD"]');
};
