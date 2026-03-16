import { wait } from '../utils/utils.js';

export const setRegistrationMonthYear = async (page, carData) => {
  console.log('[setRegistration] Selecting month');
  await page.select('select[name="mesec"]', '06');

  await wait(5);
  try {
    const regYear = carData.find((data) => data.name === 'letoReg').value;
    console.log('[setRegistration] Selecting year', { regYear });
    await page.select('select[name="leto"]', regYear);
  } catch (e) {
    console.log('[setRegistration] Falling back to NOVO vozilo');
    await page.select('select[name="leto"]', 'NOVO vozilo');
  }
  await wait(3);
};
