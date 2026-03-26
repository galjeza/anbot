// browser-utils.ts
import puppeteer from 'puppeteer-core'; // core only, no extra
import Steel from 'steel-sdk';

const STEEL_API_KEY =
  process.env.STEEL_API_KEY ||
  'ste-Qvl7pIHbKQWqKRpQQjyT96CK4BtJLnfn5w9QDMldrr4hX6MWZ6rbGXcQTRDvrILhC9fjkBpCFuzvoB31U21aX1kOHORkkNVUlwe';

const STEEL_SESSION_TIMEOUT_MS = 60 * 60 * 1000;

const client = new Steel({
  steelAPIKey: STEEL_API_KEY,
});

export async function setupBrowser() {
  const session = await client.sessions.create({
    // Only enable these if avtonet.si is actually blocking you —
    // each one adds cold-start latency
    useProxy: true,
    solveCaptcha: true,
    sessionTimeout: STEEL_SESSION_TIMEOUT_MS,
  });

  console.log('[Browser] Steel session created', {
    sessionId: session.id,
    sessionTimeoutMs: STEEL_SESSION_TIMEOUT_MS,
  });

  try {
    const browser = await puppeteer.connect({
      // Correct URL format per Steel docs
      browserWSEndpoint: `wss://connect.steel.dev?apiKey=${STEEL_API_KEY}&sessionId=${session.id}`,
    });

    const release = async () => {
      try {
        await browser.disconnect();
      } catch {}
      try {
        await client.sessions.release(session.id);
      } catch {}
    };

    return { browser, release };
  } catch (error) {
    await client.sessions.release(session.id).catch(() => {});
    throw error;
  }
}
