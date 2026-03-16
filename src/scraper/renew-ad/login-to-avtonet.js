import { wait } from '../utils/utils.js';

export const loginToAvtonet = async (browser, email, password) => {
  const [page] = await browser.pages();
  const emailDomain =
    email && email.includes('@') ? email.split('@')[1] : 'unknown';
  console.log('[Login] Navigating to login page', { emailDomain });
  await page.goto('https://www.avto.net/_2016mojavtonet/', { timeout: 0 });
  await wait(5);
  console.log('[Login] Waiting for login fields');
  await page.waitForSelector('input[name=enaslov]', {
    timeout: 0,
  });
  console.log('[Login] Typing credentials');
  await page.type('input[name=enaslov]', email);
  await page.type('input[name=geslo]', password);
  console.log('[Login] Accepting checkboxes');
  await page.$$eval('input[type=checkbox]', (checks) =>
    checks.forEach((check) => check.click()),
  );

  console.log('[Login] Submitting form');
  await page.$eval('button[type=submit]', (button) => button.click());
  await page.waitForSelector(
    "a[href='https://www.avto.net/_2016mojavtonet/logout.asp']",
    { timeout: 0 },
  );

  console.log('[Login] Logged in successfully');
  await wait(10);
};
