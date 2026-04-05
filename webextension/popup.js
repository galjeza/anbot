const state = {
  ads: [],
  selectedAds: new Set(),
};

const els = {
  configForm: document.getElementById('config-form'),
  email: document.getElementById('email'),
  password: document.getElementById('password'),
  hdImages: document.getElementById('hdImages'),
  refreshSubscription: document.getElementById('refresh-subscription'),
  subscriptionInfo: document.getElementById('subscription-info'),
  adType: document.getElementById('ad-type'),
  loadAds: document.getElementById('load-ads'),
  pauseMinutes: document.getElementById('pause-minutes'),
  adsList: document.getElementById('ads-list'),
  startRenewal: document.getElementById('start-renewal'),
  statusText: document.getElementById('status-text'),
};

function callBackground(type, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error ?? 'Unknown error'));
        return;
      }

      resolve(response.data);
    });
  });
}

function formatDate(value) {
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

function renderSubscriptionInfo(userData) {
  const expiration = formatDate(userData.subscriptionPaidTo);
  const isActive = userData.subscriptionPaidTo
    ? new Date(userData.subscriptionPaidTo) > new Date()
    : false;
  const status = isActive ? 'Aktivna' : 'Neaktivna';

  els.subscriptionInfo.textContent = `Naročnina: ${status} (do ${expiration})`;
}

function renderAds() {
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

function renderRenewalState(renewalState) {
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

async function loadUserData() {
  const userData = await callBackground('get-user-data');
  els.email.value = userData.email ?? '';
  els.password.value = userData.password ?? '';
  els.hdImages.checked = Boolean(userData.hdImages);
  renderSubscriptionInfo(userData);
}

async function init() {
  await loadUserData();

  const currentUser = await callBackground('get-user-data');
  if (currentUser.email) {
    try {
      const refreshedUser = await callBackground('refresh-subscription');
      renderSubscriptionInfo(refreshedUser);
    } catch (_error) {
      // Keep existing data; user can retry manually with "Osveži račun".
    }
  }

  const renewalState = await callBackground('get-renewal-state');
  renderRenewalState(renewalState);
  renderAds();
}

els.configForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    email: els.email.value.trim(),
    password: els.password.value,
    hdImages: els.hdImages.checked,
  };

  await callBackground('save-user-data', payload);
  const userData = await callBackground('get-user-data');
  renderSubscriptionInfo(userData);
});

els.refreshSubscription.addEventListener('click', async () => {
  const userData = await callBackground('refresh-subscription');
  renderSubscriptionInfo(userData);
});

els.loadAds.addEventListener('click', async () => {
  const adType = els.adType.value;
  const ads = await callBackground('fetch-active-ads', { adType });
  state.ads = ads;
  state.selectedAds = new Set(ads.map((ad) => ad.adId));
  renderAds();
});

els.startRenewal.addEventListener('click', async () => {
  const selected = state.ads.filter((ad) => state.selectedAds.has(ad.adId));
  if (!selected.length) {
    els.statusText.textContent = 'Izberi vsaj en oglas.';
    return;
  }

  await callBackground('start-renewal', {
    ads: selected,
    pauseMinutes: Number(els.pauseMinutes.value) || 0,
    adType: els.adType.value,
  });

  els.statusText.textContent = 'Obnavljanje zagnano...';
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'renewal-state-updated') {
    renderRenewalState(message.payload);
  }
});

init().catch((error) => {
  els.statusText.textContent = error.message;
});
