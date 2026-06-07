(() => {
  const ns = (window.AnBot = window.AnBot || {});
  const { wait, clickAndType } = ns.utils;

  // Mirrors src/scraper/renew-ad/solve-captcha.js — pulls two numbers out of
  // the <p> inside the second-to-last <table>, types the sum into
  // input[name="ReadTotal"] with per-digit delays.
  const solveCaptcha = async () => {
    const captchaInput = document.querySelector('input[name="ReadTotal"]');
    if (!captchaInput) {
      console.log('[solveCaptcha] No captcha on this page');
      return;
    }

    const tables = document.querySelectorAll('table');
    if (tables.length < 2) {
      console.log('[solveCaptcha] Not enough tables to locate captcha text');
      return;
    }
    const secondLastTable = tables[tables.length - 2];
    const firstParagraph = secondLastTable.querySelector('p');
    const captchaText = firstParagraph ? firstParagraph.textContent : null;
    if (!captchaText) {
      console.log('[solveCaptcha] Captcha text not found');
      return;
    }

    const captchaNumbers = captchaText.match(/\d+/g);
    if (!captchaNumbers || captchaNumbers.length !== 2) {
      console.log('[solveCaptcha] Captcha numbers not parseable', captchaText);
      return;
    }

    const sum = parseInt(captchaNumbers[0], 10) + parseInt(captchaNumbers[1], 10);
    console.log('[solveCaptcha] Sum', { captchaText, sum });

    await wait(2);
    await clickAndType(captchaInput, String(sum), { delay: 150 });
    // Human-ish pause after entering the answer.
    await wait(12);
  };

  ns.solveCaptcha = solveCaptcha;
})();
