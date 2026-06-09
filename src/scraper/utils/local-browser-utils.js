import puppeteer from 'puppeteer-core';
import { spawn, execFileSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import Store from 'electron-store';

const DEBUG_PORT = 9222;
const DEFAULT_PUPPETEER_TIMEOUT_MS = 60 * 1000;
const PORT_POLL_INTERVAL_MS = 250;
const PORT_WAIT_TIMEOUT_MS = 20 * 1000;

const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

function findInPath(binaryName) {
  const pathEnv = process.env.PATH || '';
  const sep = isWindows ? ';' : ':';
  for (const dir of pathEnv.split(sep)) {
    if (!dir) continue;
    const full = path.join(dir, binaryName);
    try {
      if (fs.existsSync(full)) return full;
    } catch {}
  }
  // Fallback: try `which` / `where` in case PATH parsing missed something
  try {
    const cmd = isWindows ? 'where' : 'which';
    const out = execFileSync(cmd, [binaryName], { encoding: 'utf8' }).trim();
    const first = out.split('\n')[0].trim();
    if (first && fs.existsSync(first)) return first;
  } catch {}
  return null;
}

function detectChromeExecutable() {
  if (isWindows) {
    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA &&
        path.join(
          process.env.LOCALAPPDATA,
          'Google',
          'Chrome',
          'Application',
          'chrome.exe',
        ),
    ];
    for (const c of candidates) {
      if (c && fs.existsSync(c)) return c;
    }
    return findInPath('chrome.exe');
  }
  if (isMac) {
    const macCandidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      path.join(
        os.homedir(),
        'Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      ),
    ];
    for (const c of macCandidates) {
      if (fs.existsSync(c)) return c;
    }
    return findInPath('google-chrome') || findInPath('chromium');
  }
  const linuxCandidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/run/current-system/sw/bin/google-chrome',
    '/run/current-system/sw/bin/google-chrome-stable',
    '/run/current-system/sw/bin/chromium',
    path.join(os.homedir(), '.nix-profile/bin/google-chrome'),
    path.join(os.homedir(), '.nix-profile/bin/google-chrome-stable'),
    path.join(os.homedir(), '.nix-profile/bin/chromium'),
  ];
  for (const c of linuxCandidates) {
    if (fs.existsSync(c)) return c;
  }
  for (const name of [
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
  ]) {
    const found = findInPath(name);
    if (found) return found;
  }
  return null;
}

function detectUserDataDir() {
  if (isWindows) {
    return path.join(
      process.env.LOCALAPPDATA || '',
      'Google',
      'Chrome',
      'User Data',
    );
  }
  if (isMac) {
    return path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'Google',
      'Chrome',
    );
  }
  return path.join(os.homedir(), '.config', 'google-chrome');
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: '127.0.0.1', port, path: '/json/version', timeout: 1000 },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      },
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForDebugPort(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(DEBUG_PORT)) return true;
    await new Promise((r) => setTimeout(r, PORT_POLL_INTERVAL_MS));
  }
  return false;
}

function fetchBrowserWSEndpoint() {
  return new Promise((resolve, reject) => {
    http
      .get(
        { host: '127.0.0.1', port: DEBUG_PORT, path: '/json/version' },
        (res) => {
          let body = '';
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () => {
            try {
              const { webSocketDebuggerUrl } = JSON.parse(body);
              if (!webSocketDebuggerUrl) {
                reject(new Error('No webSocketDebuggerUrl in /json/version'));
                return;
              }
              resolve(webSocketDebuggerUrl);
            } catch (e) {
              reject(e);
            }
          });
        },
      )
      .on('error', reject);
  });
}

function resolveChromePath() {
  try {
    const store = new Store();
    const userData = store.get('userData');
    if (userData && userData.chromePath && fs.existsSync(userData.chromePath)) {
      return userData.chromePath;
    }
  } catch {}
  return detectChromeExecutable();
}

export async function setupLocalBrowser() {
  const chromePath = resolveChromePath();
  if (!chromePath) {
    throw new Error(
      'Google Chrome ni najden. Namesti Chrome ali nastavi pot v nastavitvah.',
    );
  }

  const userDataDir = detectUserDataDir();
  const portAlreadyOpen = await isPortOpen(DEBUG_PORT);

  if (!portAlreadyOpen) {
    console.log('[LocalBrowser] Launching Chrome', {
      chromePath,
      userDataDir,
      port: DEBUG_PORT,
    });
    const proc = spawn(
      chromePath,
      [
        `--remote-debugging-port=${DEBUG_PORT}`,
        `--user-data-dir=${userDataDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--restore-last-session',
      ],
      {
        detached: true,
        stdio: 'ignore',
      },
    );
    proc.unref();

    const ready = await waitForDebugPort(PORT_WAIT_TIMEOUT_MS);
    if (!ready) {
      throw new Error(
        'Chrome je verjetno že odprt v drugem oknu brez debug porta. Zapri vsa Chrome okna in poskusi znova.',
      );
    }
  } else {
    console.log('[LocalBrowser] Reusing existing Chrome on port', DEBUG_PORT);
  }

  const wsEndpoint = await fetchBrowserWSEndpoint();
  const browser = await puppeteer.connect({
    browserWSEndpoint: wsEndpoint,
    defaultViewport: null,
    protocolTimeout: 0,
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(DEFAULT_PUPPETEER_TIMEOUT_MS);
  page.setDefaultNavigationTimeout(DEFAULT_PUPPETEER_TIMEOUT_MS);

  const release = async () => {
    try {
      if (!page.isClosed()) await page.close();
    } catch {}
    try {
      await browser.disconnect();
    } catch {}
  };

  return { browser, page, release, sessionId: null };
}
