import { wait } from '../utils/utils.js';

export const loginToAvtonet = async (browser, email, password) => {
  const [page] = await browser.pages();
  const COOKIE_ACCEPT_SELECTOR = '#CybotCookiebotDialogBodyLevelButtonAccept';
  const LOGIN_URL = 'https://www.avto.net/_2016mojavtonet/';
  const LOGIN_SUCCESS_URL = 'https://www.avto.net/_2016mojavtonet/welcome.asp';
  const emailDomain =
    email && email.includes('@') ? email.split('@')[1] : 'unknown';
  console.log('[Login] Navigating to login page', { emailDomain });
  await page.goto(LOGIN_URL, { timeout: 0 });
  await wait(5);
  const acceptCookies = async () => {
    try {
      await page.waitForSelector(COOKIE_ACCEPT_SELECTOR, {
        timeout: 15000,
      });
      await page.click(COOKIE_ACCEPT_SELECTOR);
      console.log('[Login] Accepted cookies');
    } catch {
      return;
    }
  };

  const fillAndSubmit = async () => {
    console.log('[Login] Waiting for login fields');
    await page.waitForSelector('input[name=enaslov]', {
      timeout: 0,
    });
    console.log(
      `[Login] Logging in with email: ${email} and password ${password}`,
    );
    console.log('[Login] Typing credentials');
    await page.click('input[name=enaslov]', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('input[name=enaslov]', email);
    await page.click('input[name=geslo]', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type('input[name=geslo]', password);
    console.log('[Login] Accepting checkboxes');
    await page.$$eval('input[type=checkbox]', (checks) =>
      checks.forEach((check) => check.click()),
    );

    console.log('[Login] Submitting form');
    await page.$eval('button[type=submit]', (button) => button.click());
  };

  const waitForLoginOutcome = async () => {
    await page.waitForFunction(
      (loginUrl) => window.location.href !== loginUrl,
      { timeout: 0 },
      LOGIN_URL,
    );
    return page.url();
  };

  await acceptCookies();

  let loggedIn = false;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await fillAndSubmit();
    const redirectUrl = await waitForLoginOutcome();
    console.log('[Login] Redirected after submit', { redirectUrl });

    if (redirectUrl.startsWith(LOGIN_SUCCESS_URL)) {
      loggedIn = true;
      break;
    }

    console.log('[Login] Turnstile redirect detected, retrying login', {
      redirectUrl,
    });
    await page.goto(LOGIN_URL, { timeout: 0 });
    await wait(5);
    await acceptCookies();
  }

  if (!loggedIn) {
    throw new Error('Login failed after captcha flow');
  }

  console.log('[Login] Logged in successfully');
  await wait(10);
};
