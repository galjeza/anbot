import fs from 'fs';
import path from 'path';

import { app } from 'electron';

import { setupBrowser } from './utils/browser-utils.js';
import {
  saveList,
  generateAdHash,
  downloadImage,
  wait,
  randomWait,
} from './utils/utils.js';
import { AVTONETEDITPREFIX, AVTONET_IMAGES_PREFIX } from './utils/constants.js';
import { fileURLToPath } from 'url';

const loginToAvtonet = async (browser, email, password) => {
  const page = await browser.newPage();
  await page.goto('https://www.avto.net/_2016mojavtonet/');
  await wait(5);
  await page.waitForSelector('input[name=enaslov]');
  await page.type('input[name=enaslov]', email);
  await page.type('input[name=geslo]', password);
  await page.$$eval('input[type=checkbox]', (checks) =>
    checks.forEach((check) => check.click()),
  );

  await page.$eval('button[type=submit]', (button) => button.click());
  await page.waitForSelector(
    "a[href='https://www.avto.net/_2016mojavtonet/logout.asp']",
  );
  console.log('Logged in');
};

const getCarData = async (browser, adId) => {
  const userDataPath = app.getPath('userData');
  const page = await browser.newPage();
  const editUrl = `${AVTONETEDITPREFIX}${adId}`;
  console.log(`Navigating to ${editUrl}`);
  await page.goto(`${AVTONETEDITPREFIX}${adId}`);
  await page.waitForSelector('button[name=ADVIEW]');
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

  const carData = [...textAreas, ...checkboxes, ...selects, ...inputs];

  await page.goto(`${AVTONET_IMAGES_PREFIX}${adId}`);
  const images = await page.$$eval('img', (imgs) => imgs.map((img) => img.src));
  let adImages = images.filter((img) => img.includes('images.avto.net'));
  adImages = adImages.map((img) => img.replace('_160', ''));
  carData.push({ name: 'images', value: adImages });

  const hash = generateAdHash(carData);
  const adImagesDirectory = path.join(userDataPath, 'AdImages', hash); // Save images in 'AdImages' directory within user data directory
  carData.imagePath = adImagesDirectory;
  if (!fs.existsSync(adImagesDirectory)) {
    fs.mkdirSync(adImagesDirectory, { recursive: true });

    console.log('Downloading images...');
    for (const [index, image] of adImages.entries()) {
      await downloadImage(image, path.join(adImagesDirectory, `${index}.jpg`));
    }
  } else {
    console.log('Images already downloaded.');
  }

  return carData;
};

const createNewAd = async (browser, carData) => {
  console.log('Creating new ad');
  console.log(carData);
  const newAdPage = await browser.newPage();
  // go to the new ad page
  await newAdPage.goto(
    'https://www.avto.net/_2016mojavtonet/ad_select_rubric_icons.asp?SID=10000',
  );
  await newAdPage.waitForSelector('select[name=znamka]');
  await newAdPage.select(
    'select[name=znamka]',
    carData.find((data) => data.name === 'znamka').value,
  );

  await randomWait(1, 2);

  await newAdPage.select(
    'select[name=model]',
    carData.find((data) => data.name === 'model').value,
  );

  await randomWait(1, 2);

  const selectElement = await newAdPage.$('select[name=oblika]');
  const secondOptionValue = await selectElement.evaluate(
    (select) => select.options[1].value,
  );
  await newAdPage.select('select[name=oblika]', secondOptionValue);

  await randomWait(1, 2);

  await newAdPage.select('select[name="mesec"]', '6');
  try {
    await newAdPage.select(
      'select[name="leto"]',
      carData.find((data) => data.name === 'letoReg').value,
    );
  } catch (e) {
    console.log(carData.find((data) => data.name === 'letoReg').value);
    console.log(e);
    await newAdPage.select('select[name="leto"]', 'NOVO vozilo');
  }
  await wait(3);

  const fuelElement = await newAdPage.click(
    '#' + carData.find((data) => data.name === 'gorivo').value,
  );

  await wait(2);

  await newAdPage.click('button[name="potrdi"]');
  await newAdPage.waitForSelector('.supurl');
  await newAdPage.click('.supurl');
  await newAdPage.waitForSelector('input[name=znamka]');

  console.log(carData);

  const checkboxes = await newAdPage.$$('input[type=checkbox]');
  for (const checkbox of checkboxes) {
    const name = await checkbox.evaluate((node) => node.name);
    const value = carData.find((data) => data.name === name).value;
    if (value === '1') {
      await checkbox.click();
    }
  }

  const inputs = await newAdPage.$$('input[type=text]');
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

  const selects = await newAdPage.$$('select');
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

  const textareas = await newAdPage.$$('textarea');
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

  await wait(2);
  await newAdPage.click('button[name="EDITAD"]');
};
const uploadImages = async (browser, carData) => {
  const userDataPath = app.getPath('userData'); // Get path to user data directory
  const imagesUploadPage = await browser
    .pages()
    .then((pages) => pages[pages.length - 1]);

  await imagesUploadPage.waitForSelector('.ButtonAddPhoto');
  await randomWait(2, 3);
  const numImages = carData.find((data) => data.name === 'images').value.length;

  const hash = generateAdHash(carData);

  for (let i = 0; i < numImages; i++) {
    console.log('Uploading image', i + 1, 'of', numImages);
    await imagesUploadPage.click('input[type=file]');
    await wait(2);

    const imagePath = path.join(userDataPath, 'AdImages', hash, `${i}.jpg`); // Construct the path to the image
    if (!fs.existsSync(imagePath)) {
      console.log(`Image file ${imagePath} does not exist.`);
      continue;
    }

    const imageInput = await imagesUploadPage.$('input[type=file]');
    await imageInput.uploadFile(imagePath);
    await wait(2);

    const addPhotoButtons = await imagesUploadPage.$$('.ButtonAddPhoto');
    if (addPhotoButtons.length > 0) {
      await addPhotoButtons[0].click();
      await wait(2);
      await randomWait(1, 3);
    }
  }
};

const deleteOldAd = async (browser, adId) => {
  await page.goto(
    `https://www.avto.net/_2016mojavtonet/ad_delete.asp?id=${adId}`,
  );
};

export const renewAd = async (adId, email, password) => {
  const browser = await setupBrowser();
  await loginToAvtonet(browser, email, password);
  const carData = await getCarData(browser, adId);
  await createNewAd(browser, carData);
  await uploadImages(browser, carData);
  //await deleteOldAd(browser, adId);

  await browser.close();
};

const renewAds = async (adIds, email, password) => {
  for (const adId of adIds) {
    await renewAd(adId, email, password);
  }
};
