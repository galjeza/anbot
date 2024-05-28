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

const createNewAd = async (browser, carData) => {
  try {
    const [page] = await browser.pages();
    // go to the new ad page
    await page.goto(
      'https://www.avto.net/_2016mojavtonet/ad_select_rubric_icons.asp?SID=10000',
    );
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

    // check if they contain a value of carModel
    const carModel = carData.find((data) => data.name === 'model').value;
    console.log('carModel', carModel);

    if (modelOptionsValues.includes(carModel)) {
      await page.select('select[name=model]', carModel);
    } else {
      const weirdName = carData
        .find((data) => data.name === 'model')
        .value.replace(' ', '---');
      console.log('weirdName', weirdName);
      await page.select('select[name=model]', weirdName);
    }

    await randomWait(3, 4);

    const selectElement = await page.$('select[name=oblika]');
    const secondOptionValue = await selectElement.evaluate(
      (select) => select.options[1].value,
    );
    await page.select('select[name=oblika]', secondOptionValue);

    await randomWait(1, 2);

    await page.select('select[name="mesec"]', '6');
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

    await wait(2);

    await page.click('button[name="potrdi"]');
    await page.waitForSelector('.supurl', {
      timeout: 0,
    });
    await page.click('.supurl');
    await page.waitForSelector('input[name=znamka]', { timeout: 0 });

    // check if select with name model has value of carModel

    await wait(2);
    const frameElement = await page.$('iframe');
    if (frameElement) {
      console.log('frameElement found');
      const frame = await frameElement.contentFrame();
      const frameBody = await frame.$('body');
      await frameBody.evaluate(
        (frameBody, htmlOpis) => (frameBody.innerHTML = htmlOpis),
        carData.find((data) => data.name === 'htmlOpis').value,
      );

      await wait(2);
    } else {
      console.log('frameElement not found');
    }

    const checkboxes = await page.$$('input[type=checkbox]');
    for (const checkbox of checkboxes) {
      const name = await checkbox.evaluate((node) => node.name);
      const value = carData.find((data) => data.name === name).value;
      if (value === '1') {
        await checkbox.click();
      }
    }

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

    if (carData.find((data) => data.name === 'VINobjavi').value === '1') {
      await page.click('#VINobjavi');
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

export const renewAd = async (adId, email, password, hdImages) => {
  const browser = await setupBrowser();
  await loginToAvtonet(browser, email, password);
  const carData = await getCarData(browser, adId, hdImages);
  await createNewAd(browser, carData);
  await uploadImages(browser, carData);
  await deleteOldAd(browser, adId);

  await browser.close();
};

const renewAds = async (adIds, email, password) => {
  for (const adId of adIds) {
    await renewAd(adId, email, password);
  }
};
