import { wait } from '../utils/utils.js';

export const setRegistrationMonthYear = async (page, carData) => {
  await page.select('select[name="mesec"]', '06');

  await wait(5);
  try {
    await page.select(
      'select[name="leto"]',
      carData.find((data) => data.name === 'letoReg').value,
    );
  } catch (e) {
    await page.select('select[name="leto"]', 'NOVO vozilo');
  }
  await wait(3);
};
