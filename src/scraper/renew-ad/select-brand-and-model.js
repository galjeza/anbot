import { wait } from '../utils/utils.js';

export const selectBrand = async (page, carData, adType) => {
  const znamkaOptionsValues = await page.$$eval(
    'select[name=znamka] option',
    (options) => options.map((option) => option.value),
  );

  let znamkaData = carData.find((data) => data.name === 'znamka');
  if (!znamkaData && adType === 'dostavna') {
    znamkaData = carData.find((data) => data.name === 'znamkaTEMP');
    if (znamkaData) {
    }
  }

  if (!znamkaData) {
    throw new Error(`znamka field not found for adType: ${adType}`);
  }

  if (!znamkaOptionsValues.includes(znamkaData.value)) {
    const znamkaWithoutSpaces = znamkaData.value.replaceAll(' ', '');
    await page.select('select[name=znamka]', znamkaWithoutSpaces);
  } else {
    await page.select('select[name=znamka]', znamkaData.value);
  }

  await wait(3);
};

export const resolveModelValue = (carData, adType, modelRelatedFields) => {
  if (adType === 'dostavna') {
    const modelTEMPData = carData.find((data) => data.name === 'modelTEMP');
    if (!modelTEMPData) {
      const modelData = carData.find((data) => data.name === 'model');
      if (modelData) {
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
      throw new Error('model field not found for car ad');
    }
    return modelData.value;
  }
};

export const selectModel = async (page, carModel) => {
  const modelOptionsValues = await page.$$eval(
    'select[name=model] option',
    (options) => options.map((option) => option.value),
  );

  const normalizeModelValue = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\(vsi\)/g, '')
      .replace(/[^a-z0-9]/g, '');

  console.log('[SelectModel] Available model values:', modelOptionsValues);
  console.log('[SelectModel] Requested car model:', carModel);

  const requestedModel = String(carModel || '').trim();
  const weirdName = requestedModel.replaceAll(' ', '---');

  const directMatch = modelOptionsValues.find(
    (value) => value === requestedModel,
  );

  const dashedMatch = modelOptionsValues.find((value) => value === weirdName);

  const normalizedRequested = normalizeModelValue(requestedModel);
  const normalizedMatch = modelOptionsValues.find(
    (value) =>
      normalizeModelValue(value) === normalizedRequested &&
      !value.includes('(vsi)'),
  );

  const selectedModel = directMatch || dashedMatch || normalizedMatch;

  if (!selectedModel) {
    throw new Error(
      `[SelectModel] Could not resolve model value for "${requestedModel}"`,
    );
  }

  console.log('[SelectModel] Selected model value:', selectedModel);
  await page.select('select[name=model]', selectedModel);

  await wait(3);
};
