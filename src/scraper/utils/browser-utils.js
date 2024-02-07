import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import UserAgentPlugin from 'puppeteer-extra-plugin-anonymize-ua';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import blockResourcesPlugin from 'puppeteer-extra-plugin-block-resources';

puppeteer.use(AdblockerPlugin({ blockTrackers: true }));
puppeteer.use(UserAgentPlugin());
puppeteer.use(StealthPlugin());

export async function setupBrowser() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  return browser;
}

const createNewProxyPage = async (browser) => {
  const page = await browser.newPage();
  await page.authenticate({
    username: process.env.PROXY_USERNAME,
    password: process.env.PROXY_PASSWORD,
  });

  return page;
};
