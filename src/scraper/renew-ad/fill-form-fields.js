import { wait } from '../utils/utils.js';

export const fillWysiwygOpis = async (page, carData) => {
  const source =
    carData.find((data) => data.name === 'htmlOpis') ||
    carData.find((data) => data.name === 'opombe');

  const htmlOpis = source ? source.value : null;
  if (!htmlOpis) {
    console.log('[fillWysiwygOpis] No htmlOpis/opombe value found in carData');
    return;
  }

  console.log(
    '[fillWysiwygOpis] Using source field:',
    source.name,
    'length:',
    htmlOpis.length,
    'snippet:',
    htmlOpis.slice(0, 120),
  );

  // Update both the underlying textarea and the CKEditor instance, if present.
  await page.evaluate((htmlOpis) => {
    const textarea =
      document.querySelector('#editor1') ||
      document.querySelector('textarea[name="opombe"]');

    if (textarea) {
      textarea.value = htmlOpis;
    }

    if (
      window.CKEDITOR &&
      window.CKEDITOR.instances &&
      window.CKEDITOR.instances.editor1
    ) {
      window.CKEDITOR.instances.editor1.setData(htmlOpis);
    }
  }, htmlOpis);

  await wait(2);
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
      // The main description ("opombe"/HTML opis) is handled separately
      // in fillWysiwygOpis, so skip it here to avoid duplicating or
      // corrupting the description content.
      if (name === 'opombe') {
        continue;
      }
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
