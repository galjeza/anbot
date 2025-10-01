import { fixGasType } from '../utils/avtonetutils.js';

export const setFuelType = async (page, carData) => {
  const gasType = carData.find((data) => data.name === 'gorivo').value;
  const fixedGasType = fixGasType(gasType);

  await page.click('#' + fixedGasType);
};
