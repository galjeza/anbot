function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(text) {
  return (text ?? '').trim().toLowerCase();
}

function findClickableByText(candidates, textMatchers) {
  const elements = Array.from(document.querySelectorAll(candidates));
  for (const element of elements) {
    const text = normalize(element.textContent);
    if (!text) {
      continue;
    }

    const matches = textMatchers.some((matcher) => text.includes(matcher));
    if (matches) {
      return element;
    }
  }

  return null;
}

async function ensureLoggedIn(email, password) {
  const emailInput = document.querySelector('input[type="email"], input[name*="mail" i]');
  const passwordInput = document.querySelector('input[type="password"]');

  if (!emailInput || !passwordInput) {
    return;
  }

  emailInput.focus();
  emailInput.value = email;
  emailInput.dispatchEvent(new Event('input', { bubbles: true }));

  passwordInput.focus();
  passwordInput.value = password;
  passwordInput.dispatchEvent(new Event('input', { bubbles: true }));

  const submitButton =
    document.querySelector('button[type="submit"], input[type="submit"]') ||
    findClickableByText('button, a, input[type="button"]', ['prijava', 'login']);

  if (submitButton) {
    submitButton.click();
    await sleep(6000);
  }
}

async function clickRenewButton() {
  const renewButton =
    findClickableByText('button, a', [
      'obnovi',
      'podaljšaj',
      'ponovno objavi',
      'uredi oglas',
    ]) || document.querySelector('a[href*="OddajaOglasa.asp" i]');

  if (!renewButton) {
    throw new Error('Ne najdem gumba za obnovo oglasa na strani.');
  }

  renewButton.click();
  await sleep(5000);
}

async function publishIfPossible() {
  const publishButton =
    findClickableByText('button, a, input[type="submit"]', [
      'objavi',
      'shrani',
      'potrdi',
      'nadaljuj',
    ]) || document.querySelector('input[type="submit"]');

  if (publishButton) {
    publishButton.click();
    await sleep(5000);
  }
}

async function renewCurrentAd(payload) {
  const { email, password } = payload;

  await ensureLoggedIn(email, password);
  await clickRenewButton();

  for (let i = 0; i < 3; i += 1) {
    await publishIfPossible();
    await sleep(2000);
  }

  return { ok: true };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'renew-current-ad') {
    return false;
  }

  renewCurrentAd(message.payload)
    .then((result) => sendResponse(result))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });

  return true;
});
