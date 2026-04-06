type MessagePayload = Record<string, unknown>;

type DebugLogEntry = {
  ts: string;
  level: string;
  message: string;
  context: unknown;
};

type AdItem = {
  adId: string;
  name: string;
  price: string;
};

type RenewalState = {
  running: boolean;
  completed: number;
  total: number;
  message: string;
  errors?: Array<{ adId: string; message: string }>;
};

type UserData = {
  email: string;
  password: string;
  subscriptionPaidTo?: string;
};

const state: {
  ads: AdItem[];
  selectedAds: Set<string>;
  debugLog: DebugLogEntry[];
} = {
  ads: [],
  selectedAds: new Set(),
  debugLog: [],
};

function getElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing DOM element: ${id}`);
  }
  return el as T;
}

const els = {
  configForm: getElement<HTMLFormElement>('config-form'),
  email: getElement<HTMLInputElement>('email'),
  password: getElement<HTMLInputElement>('password'),
  refreshSubscription: getElement<HTMLButtonElement>('refresh-subscription'),
  subscriptionInfo: getElement<HTMLParagraphElement>('subscription-info'),
  errorText: getElement<HTMLParagraphElement>('error-text'),
  adType: getElement<HTMLSelectElement>('ad-type'),
  loadAds: getElement<HTMLButtonElement>('load-ads'),
  pauseMinutes: getElement<HTMLInputElement>('pause-minutes'),
  adsList: getElement<HTMLDivElement>('ads-list'),
  startRenewal: getElement<HTMLButtonElement>('start-renewal'),
  statusText: getElement<HTMLParagraphElement>('status-text'),
  debugLog: getElement<HTMLPreElement>('debug-log'),
  clearLogs: getElement<HTMLButtonElement>('clear-logs'),
};

function logLocal(message: string, context: unknown = null): void {
  const line = context ? `${message} ${JSON.stringify(context)}` : message;
  console.log('[Popup]', line);
}

function setError(message: string): void {
  if (!message) {
    els.errorText.hidden = true;
    els.errorText.textContent = '';
    return;
  }

  els.errorText.hidden = false;
  els.errorText.textContent = message;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function renderDebugLog(): void {
  if (!state.debugLog.length) {
    els.debugLog.textContent = 'Ni logov.';
    return;
  }

  els.debugLog.textContent = state.debugLog
    .slice(-150)
    .map((item) => {
      const context = item.context ? ` ${JSON.stringify(item.context)}` : '';
      return `[${item.ts}] [${item.level}] ${item.message}${context}`;
    })
    .join('\n');

  els.debugLog.scrollTop = els.debugLog.scrollHeight;
}

function callBackground<T>(type: string, payload: MessagePayload = {}): Promise<T> {
  logLocal('Sending message', { type, payload });

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response: any) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error ?? 'Unknown error'));
        return;
      }

      resolve(response.data as T);
    });
  });
}

function formatDate(value: string | undefined): string {
  if (!value) {
    return 'Ni podatka';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Ni podatka'
    : date.toLocaleDateString('sl-SI', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
}

function renderSubscriptionInfo(userData: UserData): void {
  const expiration = formatDate(userData.subscriptionPaidTo);
  const isActive = userData.subscriptionPaidTo
    ? new Date(userData.subscriptionPaidTo) > new Date()
    : false;
  const status = isActive ? 'Aktivna' : 'Neaktivna';
  els.subscriptionInfo.textContent = `Naročnina: ${status} (do ${expiration})`;
}

function renderAds(): void {
  els.adsList.innerHTML = '';

  if (!state.ads.length) {
    els.adsList.innerHTML = '<div class="ad-row">Ni naloženih oglasov.</div>';
    return;
  }

  for (const ad of state.ads) {
    const row = document.createElement('label');
    row.className = 'ad-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.selectedAds.has(ad.adId);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        state.selectedAds.add(ad.adId);
      } else {
        state.selectedAds.delete(ad.adId);
      }
    });

    const name = document.createElement('span');
    name.className = 'ad-name';
    name.textContent = ad.name || '(Brez naziva)';

    const price = document.createElement('span');
    price.className = 'ad-price';
    price.textContent = ad.price || '';

    row.appendChild(checkbox);
    row.appendChild(name);
    row.appendChild(price);
    els.adsList.appendChild(row);
  }
}

function renderRenewalState(renewalState: RenewalState): void {
  if (!renewalState.running && !renewalState.message) {
    els.statusText.textContent = 'Ni aktivnega obnavljanja.';
    return;
  }

  const errorCount = renewalState.errors?.length ?? 0;
  els.statusText.textContent = `${renewalState.message} (${renewalState.completed}/${renewalState.total})`;

  if (errorCount > 0) {
    els.statusText.textContent += ` | Napake: ${errorCount}`;
  }
}

async function loadUserData(): Promise<void> {
  const userData = await callBackground<UserData>('get-user-data');
  els.email.value = userData.email ?? '';
  els.password.value = userData.password ?? '';
  renderSubscriptionInfo(userData);
}

async function loadDebugLog(): Promise<void> {
  state.debugLog = await callBackground<DebugLogEntry[]>('get-debug-log');
  renderDebugLog();
}

async function init(): Promise<void> {
  setError('');
  await loadUserData();

  const currentUser = await callBackground<UserData>('get-user-data');
  if (currentUser.email) {
    try {
      const refreshedUser = await callBackground<UserData>('refresh-subscription');
      renderSubscriptionInfo(refreshedUser);
    } catch (error) {
      setError(`Osvežitev računa ni uspela: ${formatError(error)}`);
    }
  }

  const renewalState = await callBackground<RenewalState>('get-renewal-state');
  renderRenewalState(renewalState);
  renderAds();
  await loadDebugLog();
}

els.configForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setError('');

  try {
    const payload = {
      email: els.email.value.trim(),
      password: els.password.value,
    };

    await callBackground<UserData>('save-user-data', payload);
    const userData = await callBackground<UserData>('get-user-data');
    renderSubscriptionInfo(userData);
  } catch (error) {
    setError(`Shranjevanje ni uspelo: ${formatError(error)}`);
  }
});

els.refreshSubscription.addEventListener('click', async () => {
  setError('');
  try {
    const userData = await callBackground<UserData>('refresh-subscription');
    renderSubscriptionInfo(userData);
  } catch (error) {
    setError(`Osvežitev računa ni uspela: ${formatError(error)}`);
  }
});

els.loadAds.addEventListener('click', async () => {
  setError('');
  els.statusText.textContent = 'Nalagam oglase...';

  try {
    const adType = els.adType.value;
    const ads = await callBackground<AdItem[]>('fetch-active-ads', { adType });
    state.ads = ads;
    state.selectedAds = new Set(ads.map((ad) => ad.adId));
    renderAds();
    els.statusText.textContent = `Naloženih oglasov: ${ads.length}`;
  } catch (error) {
    setError(`Nalagam oglase ni uspelo: ${formatError(error)}`);
    els.statusText.textContent = 'Napaka pri nalaganju oglasov.';
  }
});

els.startRenewal.addEventListener('click', async () => {
  setError('');

  try {
    const selected = state.ads.filter((ad) => state.selectedAds.has(ad.adId));
    if (!selected.length) {
      setError('Izberi vsaj en oglas.');
      return;
    }

    await callBackground<unknown>('start-renewal', {
      ads: selected,
      pauseMinutes: Number(els.pauseMinutes.value) || 0,
      adType: els.adType.value,
    });

    els.statusText.textContent = 'Obnavljanje zagnano...';
  } catch (error) {
    setError(`Zagon obnavljanja ni uspel: ${formatError(error)}`);
  }
});

els.clearLogs.addEventListener('click', async () => {
  setError('');
  try {
    await callBackground<DebugLogEntry[]>('clear-debug-log');
    state.debugLog = [];
    renderDebugLog();
  } catch (error) {
    setError(`Brisanje logov ni uspelo: ${formatError(error)}`);
  }
});

chrome.runtime.onMessage.addListener((message: any) => {
  if (message.type === 'renewal-state-updated') {
    renderRenewalState(message.payload as RenewalState);
  }

  if (message.type === 'debug-log-updated') {
    state.debugLog.push(message.payload as DebugLogEntry);
    renderDebugLog();
  }
});

init().catch((error) => {
  setError(`Inicializacija ni uspela: ${formatError(error)}`);
  logLocal('Init failed', { error: formatError(error) });
});
