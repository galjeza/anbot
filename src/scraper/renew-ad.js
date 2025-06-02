import fs from 'fs';
import path from 'path';

import { app } from 'electron';
import { reduceSharpnessDesaturateAndBlurEdges } from './utils/utils.js';

import { setupBrowser } from './utils/browser-utils.js';
import {
  getAdImagesDirectory,
  downloadImage,
  wait,
  randomWait,
} from './utils/utils.js';

import { fixGasType } from './utils/avtonetutils.js';
import { AVTONETEDITPREFIX, AVTONET_IMAGES_PREFIX } from './utils/constants.js';
import { humanDelay } from './utils/waiting.js';

const solveCaptcha = async (page) => {
  const captchaElement = await page.$('input[name="ReadTotal"]');
  if (captchaElement) {
    console.log('Captcha element found');
  } else {
    console.log('No captcha element found');
  }
  const tables = await page.$$('table');
  const secondLastTable = tables[tables.length - 2];
  const captchaText = await secondLastTable.evaluate((table) => {
    const firstParagraph = table.querySelector('p');
    return firstParagraph ? firstParagraph.textContent : null;
  });
  console.log('Captcha text:', captchaText);
  if (captchaText) {
    const captchaNumbers = captchaText.match(/\d+/g);
    if (captchaNumbers && captchaNumbers.length === 2) {
      const sum = parseInt(captchaNumbers[0]) + parseInt(captchaNumbers[1]);
      console.log(
        `Solving captcha: ${captchaNumbers[0]} + ${captchaNumbers[1]} = ${sum}`,
      );

      // Click and clear field with human-like timing
      await page.click('input[name="ReadTotal"]', { clickCount: 3 });
      await wait(2);
      await page.keyboard.press('Backspace');
      await wait(2);

      // Type sum with human-like delays between digits
      const sumStr = sum.toString();
      for (let i = 0; i < sumStr.length; i++) {
        await page.type('input[name="ReadTotal"]', sumStr[i], {
          delay: 150,
        });
        await wait(2);
      }

      await wait(12);
    }
  } else {
    console.log('No captcha element found');
  }
};

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

  await wait(30);
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
    console.log(`Price changed from ${originalPrice} to ${newPrice}`);
  }

  if (letoRegField) {
    const originalYear = letoRegField.value;
    const newYear = randomRegistrationYear();
    letoRegField.value = newYear;
    console.log(`Registration year changed from ${originalYear} to ${newYear}`);
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

    await solveCaptcha(page);

    await wait(2);
    await page.click('button[name="EDITAD"]');
  } catch (e) {
    console.log(e);
    throw e;
  }
};
const uploadImages = async (browser, carData) => {
  const userDataPath = app.getPath('userData');
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      let imagesUploadPage = await browser
        .pages()
        .then((pages) => pages[pages.length - 1]);

      // Wait for navigation to complete
      await imagesUploadPage
        .waitForNavigation({ timeout: 30000 })
        .catch(() => {});

      // Check if we're on the correct page by looking for multiple possible selectors
      const selectors = ['.mojtrg', '.ButtonAddPhoto', 'input[type=file]'];
      let foundSelector = false;

      for (const selector of selectors) {
        const element = await imagesUploadPage.$(selector);
        if (element) {
          foundSelector = true;
          break;
        }
      }

      if (!foundSelector) {
        throw new Error('Not on the correct page for image upload');
      }

      await randomWait(2, 3);

      const infoIcon = await imagesUploadPage.$('.fa.fa-info-circle.fa-lg');
      if (infoIcon) {
        await infoIcon.click().catch(() => {});
        await wait(2);
      }

      const numImages = carData.find((data) => data.name === 'images').value
        .length;

      for (let i = 0; i < numImages; i++) {
        await wait(3);
        imagesUploadPage = await browser
          .pages()
          .then((pages) => pages[pages.length - 1]);

        console.log('Uploading image', i + 1, 'of', numImages);

        // Wait for file input with increased timeout
        await imagesUploadPage.waitForSelector('input[type=file]', {
          timeout: 30000,
          visible: true,
        });

        const fileInput = await imagesUploadPage.$('input[type=file]');
        if (!fileInput) {
          throw new Error('File input not found');
        }

        const adImagesDirectory = getAdImagesDirectory(carData, userDataPath);
        const imagePath = path.join(adImagesDirectory, `${i}.jpg`);

        if (!fs.existsSync(imagePath)) {
          console.log(`Image file ${imagePath} does not exist.`);
          continue;
        }

        await fileInput.uploadFile(imagePath);
        await wait(2);

        const addPhotoButtons = await imagesUploadPage.$$('.ButtonAddPhoto');
        if (addPhotoButtons.length > 0) {
          await addPhotoButtons[0].click().catch(() => {});
          await wait(4);
        }
      }

      // If we get here without errors, break the retry loop
      break;
    } catch (error) {
      console.log(`Attempt ${retryCount + 1} failed:`, error.message);
      retryCount++;

      if (retryCount === maxRetries) {
        throw new Error(
          `Failed to upload images after ${maxRetries} attempts: ${error.message}`,
        );
      }

      // Wait before retrying
      await wait(5);
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
  await deleteOldAd(browser, adId);
  await createNewAd(browser, carData, adType);
  await uploadImages(browser, carData);

  await browser.close();
};

const renewAds = async (adIds, email, password) => {
  for (const adId of adIds) {
    await renewAd(adId, email, password);
  }
};
