import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import UserAgentPlugin from 'puppeteer-extra-plugin-anonymize-ua';
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';
import blockResourcesPlugin from 'puppeteer-extra-plugin-block-resources';

puppeteer.use(AdblockerPlugin({ blockTrackers: true }));
puppeteer.use(UserAgentPlugin());
puppeteer.use(StealthPlugin());

//blockResourcesPlugin.blockedTypes.add("stylesheet");
//blockResourcesPlugin.blockedTypes.add("other");
//blockResourcesPlugin.blockedTypes.add("image");
//blockResourcesPlugin.blockedTypes.add("media");
//blockResourcesPlugin.blockedTypes.add("font");

puppeteer.use(blockResourcesPlugin);

export async function setupBrowser() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      //`--proxy-server=http://${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`,
    ],
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
