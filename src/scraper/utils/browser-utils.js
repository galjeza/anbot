// browser-utils.ts
import puppeteer from 'puppeteer-core'; // core only, no extra
import Steel from 'steel-sdk';

const STEEL_API_KEY =
  process.env.STEEL_API_KEY ||
  'ste-Qvl7pIHbKQWqKRpQQjyT96CK4BtJLnfn5w9QDMldrr4hX6MWZ6rbGXcQTRDvrILhC9fjkBpCFuzvoB31U21aX1kOHORkkNVUlwe';

const STEEL_SESSION_TIMEOUT_MS = 60 * 60 * 1000;
const DEFAULT_PUPPETEER_TIMEOUT_MS = 60 * 1000;

export const steelClient = new Steel({
  steelAPIKey: STEEL_API_KEY,
});

export async function setupBrowser() {
  const session = await steelClient.sessions.create({
    useProxy: true,
    solveCaptcha: true,
    timeout: STEEL_SESSION_TIMEOUT_MS,
  });

  console.log('[Browser] Steel session created', {
    sessionId: session.id,
    sessionTimeoutMs: STEEL_SESSION_TIMEOUT_MS,
  });

  try {
    const browser = await puppeteer.connect({
      // Correct URL format per Steel docs
      browserWSEndpoint: `wss://connect.steel.dev?apiKey=${STEEL_API_KEY}&sessionId=${session.id}`,
      protocolTimeout: STEEL_SESSION_TIMEOUT_MS,
    });

    const applyPageTimeouts = (page) => {
      page.setDefaultTimeout(DEFAULT_PUPPETEER_TIMEOUT_MS);
      page.setDefaultNavigationTimeout(DEFAULT_PUPPETEER_TIMEOUT_MS);
    };

    const existingPages = await browser.pages();
    for (const page of existingPages) {
      applyPageTimeouts(page);
    }

    browser.on('targetcreated', async (target) => {
      if (target.type() !== 'page') return;
      try {
        const page = await target.page();
        if (page) applyPageTimeouts(page);
      } catch {}
    });

    const release = async () => {
      try {
        await browser.disconnect();
      } catch {}
      try {
        await steelClient.sessions.release(session.id);
      } catch {}
    };

    return { browser, release, sessionId: session.id };
  } catch (error) {
    await steelClient.sessions.release(session.id).catch(() => {});
    throw error;
  }
}
