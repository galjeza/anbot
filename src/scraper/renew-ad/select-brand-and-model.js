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
      console.log('Using znamkaTEMP field for dostavna ad:', znamkaData.value);
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
};

export const resolveModelValue = (carData, adType, modelRelatedFields) => {
  if (adType === 'dostavna') {
    const modelTEMPData = carData.find((data) => data.name === 'modelTEMP');
    if (!modelTEMPData) {
      console.error('ERROR: modelTEMP field not found for dostavna ad!');
      console.error('Available model-related fields:', modelRelatedFields);
      const modelData = carData.find((data) => data.name === 'model');
      if (modelData) {
        console.log('Falling back to regular model field:', modelData.value);
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
    console.log('weirdName', weirdName);
    await page.select('select[name=model]', weirdName);
  }
};
