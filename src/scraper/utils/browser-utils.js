import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import UserAgentPlugin from 'puppeteer-extra-plugin-anonymize-ua';
import puppeteer from 'puppeteer-extra';
puppeteer.use(UserAgentPlugin());
puppeteer.use(StealthPlugin());

import Store from 'electron-store';

async function getUsersChromePath() {
  const store = new Store();
  const chromePath = store.get('chromePath');
  return chromePath;
}

export async function setupBrowser() {
  const chromePath = await getUsersChromePath();
  console.log('chromePath', chromePath);
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  return browser;
}
