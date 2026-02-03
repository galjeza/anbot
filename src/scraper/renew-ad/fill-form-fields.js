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
    const meta = await checkbox.evaluate((node) => ({
      name: node.name,
      value: node.value,
      checked: node.checked,
    }));

    // Try exact match first (augmented names like "opombeznamka|BMW")
    let dataEntry = carData.find((d) => d.name === meta.name);

    // If not found and this is a brand compatibility checkbox, use augmented lookup
    if (!dataEntry && meta.name === 'opombeznamka') {
      dataEntry = carData.find((d) => d.name === `opombeznamka|${meta.value}`);
    }

    if (!dataEntry) {
      if (meta.name === 'opombeznamka') {
        console.log('[Fill] Brand checkbox has no data entry', {
          brand: meta.value,
        });
      }
      continue;
    }

    const shouldBeChecked = dataEntry.value === '1' || dataEntry.value === true;

    // Idempotent toggle: only click when state differs
    if (shouldBeChecked !== meta.checked) {
      if (meta.name === 'opombeznamka') {
        console.log('[Fill] Clicking brand checkbox', {
          brand: meta.value,
          desired: shouldBeChecked,
          current: meta.checked,
        });
      }
      await checkbox.click();
    } else if (meta.name === 'opombeznamka') {
      console.log('[Fill] Brand checkbox already in desired state', {
        brand: meta.value,
        desired: shouldBeChecked,
      });
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
        await textarea.evaluate((node) => {
          node.value = '';
        });
        await textarea.type(value);
      }
    } catch (e) {
      continue;
    }
  }
};
