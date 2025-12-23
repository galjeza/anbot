import fs from 'fs';
import path from 'path';
import { app } from 'electron';

import { reduceSharpnessDesaturateAndBlurEdges } from '../utils/utils.js';
import { getAdImagesDirectory, downloadImage, wait } from '../utils/utils.js';
import { AVTONETEDITPREFIX, AVTONET_IMAGES_PREFIX } from '../utils/constants';
import { solveCaptcha } from './solve-captcha.js';

export const getCarData = async (browser, adId, hdImages, adType = 'car') => {
  const userDataPath = app.getPath('userData');
  const [page] = await browser.pages();
  const editUrl = `${AVTONETEDITPREFIX}${adId}`;
  await page.goto(`${AVTONETEDITPREFIX}${adId}`, { timeout: 0 });
  await page.waitForSelector('button[name=ADVIEW]', { timeout: 0 });
  await wait(3);

  const textAreas = await page.$$eval('textarea', (textareas) =>
    textareas.map((textarea) => ({
      name: textarea.name,
      value: textarea.value,
    })),
  );

  const checkboxes = await page.$$eval('input[type=checkbox]', (inputs) =>
    inputs.map((input) => {
      const baseName = input.name;
      const augmentedName =
        baseName === 'opombeznamka' && input.value
          ? `${baseName}|${input.value}`
          : baseName;
      return {
        name: augmentedName,
        value: input.checked ? '1' : '0',
      };
    }),
  );

  try {
    const totalCheckboxes = checkboxes.length;
    const brandCompat = checkboxes.filter((c) => c.name.startsWith('opombeznamka|'));
    const brandCompatSample = brandCompat
      .slice(0, 10)
      .map((c) => `${c.name.split('|')[1]}=${c.value}`);
    console.log(
      '[Scrape] Checkboxes:',
      { total: totalCheckboxes, brandCompatCount: brandCompat.length, brandCompatSample },
    );
  } catch (e) {
    console.log('[Scrape] Checkbox logging failed', e);
  }

  const selects = await page.$$eval('select', (selects) =>
    selects.map((select) => ({
      name: select.name,
      value: select.value,
    })),
  );

  const inputs = await page.$$eval('input', (inputs) =>
    inputs.map((input) => ({
      name: input.name,
      value: input.value,
    })),
  );

  // Prefer reading the HTML description from the textarea that CKEditor binds to
  // instead of assuming the first iframe on the page is the editor.
  const htmlOpisField = textAreas.find((textarea) => textarea.name === 'opombe');
  const htmlOpis = htmlOpisField ? htmlOpisField.value : null;

  console.log(
    '[getCarData] htmlOpisField name:',
    htmlOpisField ? htmlOpisField.name : null,
  );
  console.log(
    '[getCarData] htmlOpis length:',
    htmlOpis ? htmlOpis.length : 0,
    'snippet:',
    htmlOpis ? htmlOpis.slice(0, 120) : '',
  );

  const carData = [
    ...textAreas,
    ...checkboxes,
    ...selects,
    ...inputs,
    { name: 'htmlOpis', value: htmlOpis },
  ];

  // Add logging to see what fields were scraped

  // Log all field names for debugging

  function randomPriceOffset() {
    const offset = Math.floor(Math.random() * 50) + 1;
    return Math.random() < 0.5 ? -offset : offset;
  }

  function randomRegistrationYear() {
    const currentYear = new Date().getFullYear();
    const minYear = currentYear - 20; // Let's set a reasonable minimum year
    const randomYear =
      Math.floor(Math.random() * (currentYear - minYear + 1)) + minYear;
    return randomYear.toString();
  }

  const priceField = inputs.find((input) => input.name === 'cena');
  const letoRegField = carData.find((data) => data.name === 'letoReg');

  if (priceField) {
    const originalPrice = parseInt(priceField.value) || 1000;
    const newPrice = Math.max(100, originalPrice + randomPriceOffset());
    await page.click('input[name="cena"]', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('input[name="cena"]', newPrice.toString());
  }

  if (letoRegField) {
    const originalYear = letoRegField.value;
    const newYear = randomRegistrationYear();
    await page.click('input[name="letoReg"]', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('input[name="letoReg"]', newYear);
  }

  await wait(3);

  await solveCaptcha(page);

  await page.click('button[name=ADVIEW]');
  await wait(3);
  // -------------------------------------------------------------------------

  await page.goto(`${AVTONET_IMAGES_PREFIX}${adId}`, { timeout: 0 });
  const images = await page.$$eval('img', (imgs) => imgs.map((img) => img.src));
  let adImages = images.filter((img) => img.includes('images.avto.net'));
  adImages = adImages.map((img) => img.replace('_160', ''));
  console.log('- Found images: ', adImages);
  if (hdImages) {
    adImages = adImages.map((img) => img.replace('.jpg', '_HD.jpg'));
  }

  carData.push({ name: 'images', value: adImages });

  const adImagesDirectory = getAdImagesDirectory(carData, userDataPath, adType);
  carData.imagePath = adImagesDirectory;
  if (!fs.existsSync(adImagesDirectory)) {
    fs.mkdirSync(adImagesDirectory, { recursive: true });

    for (const [index, image] of adImages.entries()) {
      console.log(
        'Downloading image to: ',
        path.join(adImagesDirectory, `${index}.jpg`),
      );
      await downloadImage(image, path.join(adImagesDirectory, `${index}.jpg`));
      if (!hdImages) {
        await reduceSharpnessDesaturateAndBlurEdges(
          path.join(adImagesDirectory, `${index}.jpg`),
        );
      }
    }
  } else {
    console.log('Images already downloaded');
    console.log('Images directory: ', adImagesDirectory);
  }

  return carData;
};
