import fs from 'fs';
import path from 'path';

import { app } from 'electron';
import { reduceSharpnessDesaturateAndBlurEdges } from './utils/utils.js';

import { setupBrowser } from './utils/browser-utils.js';
import {
  saveList,
  getAdImagesDirectory,
  downloadImage,
  wait,
  randomWait,
} from './utils/utils.js';

import { fixGasType } from './utils/avtonetutils.js';
import { AVTONETEDITPREFIX, AVTONET_IMAGES_PREFIX } from './utils/constants.js';
import { fileURLToPath } from 'url';
import { humanDelay } from './utils/waiting.js';

const loginToAvtonet = async (browser, email, password) => {
  const [page] = await browser.pages();
  await page.goto('https://www.avto.net/_2016mojavtonet/', { timeout: 0 });
  await wait(5);
  await page.waitForSelector('input[name=enaslov]', {
    timeout: 0,
  });
  await page.type('input[name=enaslov]', email);
  await page.type('input[name=geslo]', password);
  await page.$$eval('input[type=checkbox]', (checks) =>
    checks.forEach((check) => check.click()),
  );

  await page.$eval('button[type=submit]', (button) => button.click());
  await page.waitForSelector(
    "a[href='https://www.avto.net/_2016mojavtonet/logout.asp']",
    { timeout: 0 },
  );
  console.log('Logged in');
};

const getCarData = async (browser, adId, hdImages) => {
  const userDataPath = app.getPath('userData');
  const [page] = await browser.pages();
  const editUrl = `${AVTONETEDITPREFIX}${adId}`;
  console.log(`Navigating to ${editUrl}`);
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
    inputs.map((input) => ({
      name: input.name,
      value: input.checked ? '1' : '0',
    })),
  );

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

  const frameElement = await page.$('iframe');
  let htmlOpis;
  if (frameElement) {
    const frame = await frameElement.contentFrame();
    const frameBody = await frame.$('body');
    const innerHTML = await frame.evaluate(
      (frameBody) => frameBody.innerHTML,
      frameBody,
    );
    htmlOpis = innerHTML;
  }

  const carData = [
    ...textAreas,
    ...checkboxes,
    ...selects,
    ...inputs,
    { name: 'htmlOpis', value: htmlOpis },
  ];

  // Helper functions for random changes:
  function randomPriceOffset() {
    // random offset between -250 and +249
    return Math.floor(Math.random() * 500) - 250;
  }
  function randomKmOffset() {
    // random offset between -1000 and +999
    return Math.floor(Math.random() * 2000) - 1000;
  }
  function randomYearOfRegistration(from, to) {
    // random year between from and to
    return from + Math.floor(Math.random() * (to - from + 1));
  }

  // Figure out which inputs contain price, kilometers, and name:
  const priceField = inputs.find((input) => input.name === 'cena');
  // Avtonet often uses `prevozenikm` for kilometers, adjust if needed:
  const kmField = inputs.find((input) => input.name === 'prevozenikm');
  // Example: The "title" of the ad might be in an input called 'naslov' (adjust as needed).
  const letoRegField = inputs.find((input) => input.name === 'letoReg');

  // Edit price
  if (priceField) {
    const originalPrice = parseInt(priceField.value) || 1000;
    const newPrice = Math.max(100, originalPrice + randomPriceOffset());
    // Triple-click to highlight existing text
    await page.click('input[name="cena"]', { clickCount: 3 });
    // Press Backspace to clear the field
    await page.keyboard.press('Backspace');
    // Type in the new price
    await page.type('input[name="cena"]', newPrice.toString());
    console.log(`Price changed from ${originalPrice} to ${newPrice}`);
  }

  // Edit kilometers
  if (kmField) {
    const originalKm = parseInt(kmField.value) || 50000;
    const newKm = Math.max(0, originalKm + randomKmOffset());
    await page.click('input[name="prevozenikm"]', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('input[name="prevozenikm"]', newKm.toString());
    console.log(`Kilometers changed from ${originalKm} to ${newKm}`);
  }

  // Edit "year of registration" (example)
  if (letoRegField) {
    const originalYear = parseInt(letoRegField.value) || 2010; // Example original
    const newYear = randomYearOfRegistration(2005, 2024);
    await page.click('input[name="letoReg"]', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('input[name="letoReg"]', newYear.toString());
    console.log(
      `Year of registration changed from ${originalYear} to ${newYear}`,
    );
  }
  await wait(3);

  // Captca solve

  const captchaElement = await page.$('input[name="ReadTotal"]');
  if (captchaElement) {
    const captchaTable = await captchaElement.evaluateHandle((el) => {
      // Find the closest table ancestor
      let current = el;
      while (current && current.tagName !== 'TABLE') {
        current = current.parentElement;
      }
      return current;
    });

    if (captchaTable) {
      const captchaText = await captchaTable.evaluate((table) => {
        const firstParagraph = table.querySelector('p');
        return firstParagraph ? firstParagraph.textContent : null;
      });

      if (captchaText) {
        const numbers = captchaText.match(/\d+/g);
        if (numbers && numbers.length === 2) {
          const sum = parseInt(numbers[0]) + parseInt(numbers[1]);
          console.log(
            `Solving captcha: ${numbers[0]} + ${numbers[1]} = ${sum}`,
          );

          // Add some random pauses to make it look more human-like
          await wait(Math.random() * 2 + 1);
          await page.type('input[name="ReadTotal"]', sum.toString());
          await wait(Math.random() * 1.5 + 0.5);
        }
      }
    }
  }

  // After changes, click the "save" or "preview" button (whatever is correct on Avto.net)
  // 'button[name=ADVIEW]' might be a preview or save; adjust as needed if there's a separate save button
  await page.click('button[name=ADVIEW]');
  await wait(3);
  // -------------------------------------------------------------------------

  await page.goto(`${AVTONET_IMAGES_PREFIX}${adId}`, { timeout: 0 });
  const images = await page.$$eval('img', (imgs) => imgs.map((img) => img.src));
  let adImages = images.filter((img) => img.includes('images.avto.net'));
  adImages = adImages.map((img) => img.replace('_160', ''));
  if (hdImages) {
    console.log('HD Images downloading');
    adImages = adImages.map((img) => img.replace('.jpg', '_HD.jpg'));
  }
  carData.push({ name: 'images', value: adImages });

  const adImagesDirectory = getAdImagesDirectory(carData, userDataPath);
  carData.imagePath = adImagesDirectory;
  if (!fs.existsSync(adImagesDirectory)) {
    fs.mkdirSync(adImagesDirectory, { recursive: true });

    for (const [index, image] of adImages.entries()) {
      await downloadImage(image, path.join(adImagesDirectory, `${index}.jpg`));
      if (!hdImages) {
        await reduceSharpnessDesaturateAndBlurEdges(
          path.join(adImagesDirectory, `${index}.jpg`),
        );
      }
    }
  } else {
  }

  return carData;
};

const createNewAd = async (browser, carData, adType) => {
  console.log('Ad type');
  console.log(adType);

  const newAdUrl = (() => {
    switch (adType) {
      case 'car':
        return 'https://www.avto.net/_2016mojavtonet/ad_select_rubric_icons.asp?SID=10000';
      case 'dostavna':
        return 'https://www.avto.net/_2016mojavtonet/ad_insert_car_step1.asp?SID=20000';
    }
  })();

  try {
    const [page] = await browser.pages();
    // go to the new ad page
    await page.goto(newAdUrl);
    await page.waitForSelector('select[name=znamka]', { timeout: 0 });

    // check if select with name znamka includes value of carData
    const znamkaOptionsValues = await page.$$eval(
      'select[name=znamka] option',
      (options) => options.map((option) => option.value),
    );

    if (
      !znamkaOptionsValues.includes(
        carData.find((data) => data.name === 'znamka').value,
      )
    ) {
      const znamkaWithoutSpaces = carData
        .find((data) => data.name === 'znamka')
        .value.replaceAll(' ', '');
      await page.select('select[name=znamka]', znamkaWithoutSpaces);
    } else {
      await page.select(
        'select[name=znamka]',
        carData.find((data) => data.name === 'znamka').value,
      );
    }

    await randomWait(1, 2);

    const modelOptionsValues = await page.$$eval(
      'select[name=model] option',
      (options) => options.map((option) => option.value),
    );

    const carModel = (() => {
      console.log('adType in carmodel', adType);
      if (adType === 'dostavna') {
        return carData.find((data) => data.name === 'modelTEMP').value;
      } else {
        return carData.find((data) => data.name === 'model').value;
      }
    })();
    if (modelOptionsValues.includes(carModel)) {
      await page.select('select[name=model]', carModel);
    } else {
      const weirdName = carData
        .find((data) => data.name === 'model')
        .value.replace(' ', '---');
      console.log('weirdName', weirdName);
      await page.select('select[name=model]', weirdName);
    }

    await page.select(
      'select[name=oblika]',
      carData.find((data) => data.name === 'oblika').value,
    );

    await randomWait(5);

    await page.select('select[name="mesec"]', '06');

    await wait(5);
    try {
      await page.select(
        'select[name="leto"]',
        carData.find((data) => data.name === 'letoReg').value,
      );
    } catch (e) {
      console.log(carData.find((data) => data.name === 'letoReg').value);
      console.log(e);
      await page.select('select[name="leto"]', 'NOVO vozilo');
    }
    await wait(3);

    const gasType = carData.find((data) => data.name === 'gorivo').value;
    const fixedGasType = fixGasType(gasType);
    console.log('fixedGasType', fixedGasType);

    const fuelElement = await page.click('#' + fixedGasType);
    console.log('First page done');
    await page.click('button[name="potrdi"]');

    console.log('GOT TO #0');
    if (adType === 'car') {
      await page.waitForSelector('.supurl', {
        timeout: 0,
      });

      console.log('GOT PASDT SUPUTLR');
      await page.click('.supurl');
    }

    console.log('GOT got cena');

    await page.waitForSelector('input[name=cena]', { timeout: 0 });

    // check if select with name model has value of carModel

    await wait(2);
    console.log('GOT to #1');
    const frameElement = await page.$('iframe');
    if (frameElement) {
      console.log('frameElement found');
      const frame = await frameElement.contentFrame();
      const frameBody = await frame.$('body');
      await frameBody.evaluate(
        (frameBody, htmlOpis) => (frameBody.innerHTML = htmlOpis),
        carData.find((data) => data.name === 'htmlOpis').value,
      );
      console.log('GOT to #2');
      await wait(2);
    } else {
      console.log('frameElement not found');
    }

    console.log('GOT to #3');

    const checkboxes = await page.$$('input[type=checkbox]');
    for (const checkbox of checkboxes) {
      const name = await checkbox.evaluate((node) => node.name);
      const value = carData.find((data) => data.name === name).value;
      if (value === '1') {
        await checkbox.click();
      }
    }

    console.log('GOT to #4');
    const inputs = await page.$$('input[type=text]');
    for (const input of inputs) {
      try {
        const name = await input.evaluate((node) => node.name);
        const value = carData.find((data) => data.name === name).value;
        if (value) {
          await input.click({ clickCount: 3 });
          await input.type(value);
        }
      } catch (e) {
        continue;
      }
    }

    const selects = await page.$$('select');
    for (const select of selects) {
      try {
        const name = await select.evaluate((node) => node.name);
        const value = carData.find((data) => data.name === name).value;
        if (value) {
          await select.select(value);
        }
      } catch (e) {
        continue;
      }
    }

    const textareas = await page.$$('textarea');
    for (const textarea of textareas) {
      try {
        const name = await textarea.evaluate((node) => node.name);
        const value = carData.find((data) => data.name === name).value;
        if (value) {
          await textarea.click({ clickCount: 3 });
          await textarea.type(value);
        }
      } catch (e) {
        continue;
      }
    }

    if (adType === 'car') {
      if (carData.find((data) => data.name === 'VINobjavi').value === '1') {
        await page.click('#VINobjavi');
      }
    }

    await wait(2);
    await page.click('button[name="EDITAD"]');
  } catch (e) {
    console.log(e);
    throw e;
  }
};
const uploadImages = async (browser, carData) => {
  const userDataPath = app.getPath('userData'); // Get path to user data directory
  let imagesUploadPage = await browser
    .pages()
    .then((pages) => pages[pages.length - 1]);

  await imagesUploadPage.waitForSelector('.mojtrg', {
    timeout: 0,
  });
  await randomWait(2, 3);

  const infoIcon = await imagesUploadPage.$('.fa.fa-info-circle.fa-lg');
  if (infoIcon) {
    await imagesUploadPage.click('.fa.fa-info-circle.fa-lg');
    await wait(2);
  }

  await imagesUploadPage.waitForSelector('.ButtonAddPhoto', {
    timeout: 0,
  });
  await randomWait(2, 3);
  const numImages = carData.find((data) => data.name === 'images').value.length;

  for (let i = 0; i < numImages; i++) {
    await wait(3);
    imagesUploadPage = await browser
      .pages()
      .then((pages) => pages[pages.length - 1]);
    console.log('Uploading image', i + 1, 'of', numImages);
    await imagesUploadPage.waitForSelector('input[type=file]', {
      timeout: 0,
    });
    await imagesUploadPage.click('input[type=file]');
    await wait(2);

    const adImagesDirectory = getAdImagesDirectory(carData, userDataPath);

    const imagePath = path.join(adImagesDirectory, `${i}.jpg`); // Construct the path to the image
    if (!fs.existsSync(imagePath)) {
      console.log(`Image file ${imagePath} does not exist.`);
      continue;
    }

    await imagesUploadPage.waitForSelector('input[type=file]', {
      timeout: 0,
    });

    const imageInput = await imagesUploadPage.$('input[type=file]');
    await imageInput.uploadFile(imagePath);
    await wait(2);

    const addPhotoButtons = await imagesUploadPage.$$('.ButtonAddPhoto');
    if (addPhotoButtons.length > 0) {
      await addPhotoButtons[0].click();
      await wait(4);
    }
  }
};

const deleteOldAd = async (browser, adId) => {
  const [page] = await browser.pages();

  await page.goto(
    `https://www.avto.net/_2016mojavtonet/ad_delete.asp?id=${adId}`,
    { timeout: 0 },
  );
};

export const renewAd = async (adId, email, password, hdImages, adType) => {
  const browser = await setupBrowser();
  await loginToAvtonet(browser, email, password);
  const carData = await getCarData(browser, adId, hdImages);
  const carDataJsonPath = path.join('./carDataTest', `${adId}.json`);
  fs.mkdirSync(path.dirname(carDataJsonPath), { recursive: true });
  fs.writeFileSync(carDataJsonPath, JSON.stringify(carData, null, 2));
  console.log('Car data');
  console.log(carData);

  await createNewAd(browser, carData, adType);
  await uploadImages(browser, carData);
  await deleteOldAd(browser, adId);

  await browser.close();
};

const renewAds = async (adIds, email, password) => {
  for (const adId of adIds) {
    await renewAd(adId, email, password);
  }
};
