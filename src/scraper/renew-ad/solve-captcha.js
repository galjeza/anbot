import { wait } from '../utils/utils.js';

export const solveCaptcha = async (page) => {
  const captchaElement = await page.$('input[name="ReadTotal"]');
  if (captchaElement) {
    console.log('[solveCaptcha] Captcha input found');
  } else {
    console.log('[solveCaptcha] Captcha input not found');
  }
  const tables = await page.$$('table');
  console.log('[solveCaptcha] Tables found', { count: tables.length });
  const secondLastTable = tables[tables.length - 2];
  const captchaText = await secondLastTable.evaluate((table) => {
    const firstParagraph = table.querySelector('p');
    return firstParagraph ? firstParagraph.textContent : null;
  });
  if (captchaText) {
    console.log('[solveCaptcha] Captcha text', { captchaText });
    const captchaNumbers = captchaText.match(/\d+/g);
    if (captchaNumbers && captchaNumbers.length === 2) {
      const sum = parseInt(captchaNumbers[0]) + parseInt(captchaNumbers[1]);
      console.log('[solveCaptcha] Captcha parsed', {
        captchaNumbers,
        sum,
      });

      // Click and clear field with human-like timing
      await page.click('input[name="ReadTotal"]', { clickCount: 3 });
      await wait(2);
      await page.keyboard.press('Backspace');
      await wait(2);

      // Type sum with human-like delays between digits
      const sumStr = sum.toString();
      for (let i = 0; i < sumStr.length; i++) {
        await page.type('input[name="ReadTotal"]', sumStr[i], {
          delay: 150,
        });
        await wait(2);
      }

      await wait(12);
    } else {
      console.log('[solveCaptcha] Captcha numbers not found');
    }
  } else {
    console.log('[solveCaptcha] Captcha text not found');
  }
};
