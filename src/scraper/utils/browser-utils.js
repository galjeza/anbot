import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import UserAgentPlugin from 'puppeteer-extra-plugin-anonymize-ua';
import puppeteer from 'puppeteer-extra';
import Store from 'electron-store';
puppeteer.use(UserAgentPlugin());
puppeteer.use(StealthPlugin());

async function getUsersChromePath() {
  // get chrome path from the electron store which is created in main.ts
  const store = new Store();
  const chromePath = store.get('userData').chromePath;
  return chromePath;
}

export async function setupBrowser() {
  // const chromePath = await getUsersChromePath();

  const browser = await puppeteer.connect({
    browserWSEndpoint:
      'wss://connect.steel.dev?apiKey=ste-7BIdDYwyeapWeXOhfFhsRXaPjNFOecYzjLIBHquwkbOob7dWYLSqzH8jmQNvprHVmDF1gAREUuifoVlN5JypA7jvzrrzUFIJWQQ',
  });

  return browser;
}
