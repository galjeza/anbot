import puppeteerVanilla from 'puppeteer';
import { addExtra } from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import UserAgentPlugin from 'puppeteer-extra-plugin-anonymize-ua';

import puppeteer from 'puppeteer-extra';
puppeteer.use(UserAgentPlugin());
puppeteer.use(StealthPlugin());

export async function setupBrowser() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  return browser;
}
