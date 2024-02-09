import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import UserAgentPlugin from 'puppeteer-extra-plugin-anonymize-ua';
import puppeteer from 'puppeteer-extra';
puppeteer.use(UserAgentPlugin());
puppeteer.use(StealthPlugin());

function getChromiumExecPath() {
  return puppeteer.executablePath().replace('app.asar', 'app.asar.unpacked');
}

export async function setupBrowser() {
  const browser = await puppeteer.launch({
    executablePath: getChromiumExecPath(),
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  return browser;
}
