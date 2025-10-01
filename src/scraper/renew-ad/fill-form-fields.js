import { wait } from '../utils/utils.js';

export const fillWysiwygOpis = async (page, carData) => {
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
};

export const fillCheckboxesFromData = async (page, carData) => {
  const checkboxes = await page.$$('input[type=checkbox]');
  for (const checkbox of checkboxes) {
    const name = await checkbox.evaluate((node) => node.name);
    const value = carData.find((data) => data.name === name).value;
    if (value === '1') {
      await checkbox.click();
    }
  }
};

export const fillInputsFromData = async (page, carData) => {
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
};

export const fillSelectsFromData = async (page, carData) => {
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
};

export const fillTextareasFromData = async (page, carData) => {
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
};
