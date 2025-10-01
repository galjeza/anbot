import { wait } from '../utils/utils.js';

export const loginToAvtonet = async (browser, email, password) => {
  const [page] = await browser.pages();
  await page.goto('https://www.avto.net/_2016mojavtonet/', { timeout: 0 });
  await wait(5);
  await page.waitForSelector('input[name=enaslov]', {
    timeout: 0,
  });
  await page.type('input[name=enaslov]', email);
  await page.type('input[name=geslo]', password);
  await page.$$eval('input[type=checkbox]', (checks) =>
    checks.forEach((check) => check.click()),
  );

  await page.$eval('button[type=submit]', (button) => button.click());
  await page.waitForSelector(
    "a[href='https://www.avto.net/_2016mojavtonet/logout.asp']",
    { timeout: 0 },
  );

  await wait(10);
};
