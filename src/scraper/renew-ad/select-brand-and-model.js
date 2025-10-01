import { randomWait } from '../utils/utils.js';

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

  await randomWait(1, 2);
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

  if (modelOptionsValues.includes(carModel)) {
    await page.select('select[name=model]', carModel);
  } else {
    const weirdName = carModel.replace(' ', '---');
    await page.select('select[name=model]', weirdName);
  }
};
