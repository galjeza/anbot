import { wait, randomWait } from '../utils/utils.js';
import { fixGasType } from '../utils/avtonetutils.js';
import { solveCaptcha } from './solve-captcha.js';

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

  const newAdUrl = (() => {
    switch (adType) {
      case 'car':
        return 'https://www.avto.net/_2016mojavtonet/ad_select_rubric_icons.asp?SID=10000';
      case 'dostavna':
        return 'https://www.avto.net/_2016mojavtonet/ad_insert_car_step1.asp?SID=20000';
      case 'platisca':
        return 'https://www.avto.net/_2016mojavtonet/ad_select_rubric_continue.asp?KodaRubrike=R10KAT1010';
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

    // Add error handling for missing znamka field
    let znamkaData = carData.find((data) => data.name === 'znamka');

    // For dostavna ads, try alternative field names if znamka is not found
    if (!znamkaData && adType === 'dostavna') {
      znamkaData = carData.find((data) => data.name === 'znamkaTEMP');
      if (znamkaData) {
        console.log(
          'Using znamkaTEMP field for dostavna ad:',
          znamkaData.value,
        );
      }
    }

    if (!znamkaData) {
      console.error('ERROR: znamka field not found in carData!');
      console.error('Available fields:', carData.map((f) => f.name).join(', '));
      throw new Error(`znamka field not found for adType: ${adType}`);
    }

    if (!znamkaOptionsValues.includes(znamkaData.value)) {
      const znamkaWithoutSpaces = znamkaData.value.replaceAll(' ', '');
      console.log(`Using znamka without spaces: ${znamkaWithoutSpaces}`);
      await page.select('select[name=znamka]', znamkaWithoutSpaces);
    } else {
      console.log(`Using original znamka: ${znamkaData.value}`);
      await page.select('select[name=znamka]', znamkaData.value);
    }

    await randomWait(1, 2);

    const modelOptionsValues = await page.$$eval(
      'select[name=model] option',
      (options) => options.map((option) => option.value),
    );

    const carModel = (() => {
      console.log('adType in carmodel', adType);
      if (adType === 'dostavna') {
        const modelTEMPData = carData.find((data) => data.name === 'modelTEMP');
        if (!modelTEMPData) {
          console.error('ERROR: modelTEMP field not found for dostavna ad!');
          console.error('Available model-related fields:', modelRelatedFields);
          // Fallback to regular model field
          const modelData = carData.find((data) => data.name === 'model');
          if (modelData) {
            console.log(
              'Falling back to regular model field:',
              modelData.value,
            );
            return modelData.value;
          } else {
            throw new Error(
              'Neither modelTEMP nor model field found for dostavna ad',
            );
          }
        }
        return modelTEMPData.value;
      } else {
        const modelData = carData.find((data) => data.name === 'model');
        if (!modelData) {
          console.error('ERROR: model field not found for car ad!');
          throw new Error('model field not found for car ad');
        }
        return modelData.value;
      }
    })();

    console.log('Selected car model:', carModel);

    if (modelOptionsValues.includes(carModel)) {
      await page.select('select[name=model]', carModel);
    } else {
      const weirdName = carModel.replace(' ', '---');
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
