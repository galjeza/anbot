// Popup-only UI for Avtonet Bot.
//
// All four screens (menu / settings / adlist / obnavljanje) are rendered into
// the same #root element. View state lives in the popup; persistent state
// (user data, in-flight job) lives in the background. Closing the popup does
// not cancel a job — the background keeps running and the next popup open
// resumes the obnavljanje view.

const root = document.getElementById('root');

// ----------------------------- RPC helpers --------------------------------

const rpc = (name, payload) =>
  new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ rpc: name, payload }, (response) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      if (!response) return reject(new Error(`No response from ${name}`));
      if (response.error) return reject(new Error(response.error));
      resolve(response.data);
    });
  });

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );

const trunc = (s, n = 38) => (s.length > n ? `${s.slice(0, n)}...` : s);

// View state (popup-local). On open we ask the background whether a job is
// running; if so we jump straight to the obnavljanje view.
let state = {
  view: 'menu',
  user: null,
  loadError: null,
  ads: [],
  selected: new Set(),
  pause: 60,
  testMode: false,
  selectAll: false,
  adType: 'car',
  adlistError: null,
  loadingAds: false,
  jobState: null,
};

const setView = (next) => {
  state.view = next;
  render();
};

// ----------------------------- Menu view ---------------------------------

const renderMenu = () => {
  if (state.loadError) {
    return `
      <div class="err-box">${escapeHtml(state.loadError)}</div>
      <button class="btn full subtle" data-act="open-settings">Konfiguracija</button>
    `;
  }

  const subDate = state.user?.subscriptionPaidTo
    ? new Date(state.user.subscriptionPaidTo)
    : null;
  const isActive = subDate && subDate > new Date();
  const subDateStr = subDate
    ? subDate.toLocaleDateString('sl-SI', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '-';

  const renewalButtons = isActive
    ? `
      <button class="btn full subtle" data-act="ads" data-adtype="car">Obnovi avtomobile</button>
      <button class="btn full subtle" data-act="ads" data-adtype="dostavna">Obnovi dostavna vozila</button>
      <button class="btn full subtle" data-act="ads" data-adtype="platisca">Obnovi platišča</button>
    `
    : `<p class="red" style="font-size:0.85rem;margin:0.5rem 0;">
        Obnova oglasov ni mogoča — nimate aktivne naročnine.
      </p>`;

  return `
    <h2 class="title">Avtonet Bot</h2>
    <div class="section">
      <p><span class="bold">Email:</span> ${escapeHtml(state.user?.email ?? '-')}</p>
      <p><span class="bold">Naročnina do:</span> ${escapeHtml(subDateStr)}</p>
      <p>
        <span class="bold">Status:</span>
        <span class="${isActive ? 'green' : 'red'}">
          ${isActive ? 'Aktivna' : 'Neaktivna'}
        </span>
      </p>
    </div>
    <button class="btn full subtle" data-act="open-settings">Konfiguracija</button>
    ${renewalButtons}
    <p class="muted" style="margin-top:0.75rem;text-align:center;">
      Obnavljanje teče v vašem trenutnem zavihku na avto.net.
    </p>
  `;
};

const wireMenu = () => {
  root.querySelector('[data-act="open-settings"]')?.addEventListener('click', () =>
    setView('settings'),
  );
  root.querySelectorAll('[data-act="ads"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.adType = btn.dataset.adtype;
      state.ads = [];
      state.selected = new Set();
      state.selectAll = false;
      state.adlistError = null;
      setView('adlist');
      loadAds();
    });
  });
};

// --------------------------- Settings view --------------------------------

const renderSettings = () => {
  const email = state.user?.email || '';
  return `
    <h2 class="title">Konfiguracija</h2>
    <p class="muted" style="margin-bottom:0.75rem;">
      Prijavite se v avto.net v zavihku brskalnika. Sem vpišite samo e-pošto
      za preverjanje naročnine.
    </p>
    <label>
      <span class="lbl">E-pošta</span>
      <input type="email" id="email" value="${escapeHtml(email)}" />
    </label>
    <div class="row-between" style="margin-top:0.5rem;">
      <button class="btn subtle" data-act="back">Nazaj</button>
      <button class="btn" data-act="save">Shrani</button>
    </div>
    <p id="settings-msg" class="muted" style="margin-top:0.5rem;"></p>
  `;
};

const wireSettings = () => {
  root.querySelector('[data-act="back"]').addEventListener('click', async () => {
    await loadUser();
    setView('menu');
  });
  root.querySelector('[data-act="save"]').addEventListener('click', async () => {
    const email = root.querySelector('#email').value.trim();
    const msg = root.querySelector('#settings-msg');
    if (!email) {
      msg.textContent = 'Vnesite e-pošto.';
      msg.className = 'red';
      return;
    }
    try {
      msg.textContent = 'Shranjujem…';
      msg.className = 'muted';
      const existing = (await rpc('get-user-data')) || {};
      await rpc('set-user-data', { ...existing, email });
      msg.textContent = 'Shranjeno.';
      msg.className = 'green';
      await loadUser();
    } catch (e) {
      msg.textContent = e.message;
      msg.className = 'red';
    }
  });
};

// ---------------------------- Adlist view ---------------------------------

const renderAdlist = () => {
  if (state.loadingAds) {
    return `<div class="spinner-msg">Nalagam oglase…</div>`;
  }
  if (state.adlistError) {
    return `
      <div class="err-box">${escapeHtml(state.adlistError)}</div>
      <button class="btn subtle" data-act="back">Nazaj</button>
    `;
  }
  const ads = state.ads;
  if (ads.length === 0) {
    return `
      <div class="spinner-msg">Ni najdenih oglasov.</div>
      <button class="btn subtle" data-act="back">Nazaj</button>
    `;
  }
  const rows = ads
    .map(
      (ad) => `
      <label class="ad-row">
        <input type="checkbox" data-adid="${escapeHtml(ad.adId)}"
          ${state.selected.has(ad.adId) ? 'checked' : ''} />
        <img src="${escapeHtml(ad.photoUrl)}" alt="" />
        <div class="info">
          <div class="name" title="${escapeHtml(ad.name)}">
            ${escapeHtml(trunc(ad.name))}
          </div>
          <div class="price">${escapeHtml(ad.price)}</div>
        </div>
      </label>
    `,
    )
    .join('');

  return `
    <h2 class="title">Izberi oglase</h2>
    <div class="controls-bar">
      <div class="row">
        <label style="margin:0;">
          <input type="checkbox" id="selectAll" ${state.selectAll ? 'checked' : ''} />
          Izberi vse (${ads.length})
        </label>
      </div>
      <div class="row">
        <label style="margin:0;">
          Pavza (min)
          <input type="number" id="pause" value="${state.pause}" min="0" />
        </label>
      </div>
      <div class="row">
        <label style="margin:0;">
          <input type="checkbox" id="testMode" ${state.testMode ? 'checked' : ''} />
          Testni način (ne izbriši starega)
        </label>
      </div>
    </div>
    <div class="ad-list">${rows}</div>
    <div class="row-between">
      <button class="btn subtle" data-act="back">Nazaj</button>
      <button class="btn" data-act="start">Obnovi izbrane (${state.selected.size})</button>
    </div>
  `;
};

const wireAdlist = () => {
  root.querySelector('[data-act="back"]')?.addEventListener('click', () =>
    setView('menu'),
  );
  root.querySelector('#selectAll')?.addEventListener('change', (e) => {
    state.selectAll = e.target.checked;
    state.selected = state.selectAll
      ? new Set(state.ads.map((a) => a.adId))
      : new Set();
    render();
  });
  root.querySelector('#pause')?.addEventListener('input', (e) => {
    state.pause = Number(e.target.value) || 0;
  });
  root.querySelector('#testMode')?.addEventListener('change', (e) => {
    state.testMode = e.target.checked;
  });
  root.querySelectorAll('input[data-adid]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const id = cb.dataset.adid;
      if (cb.checked) state.selected.add(id);
      else state.selected.delete(id);
      state.selectAll = state.selected.size === state.ads.length;
      render();
    });
  });
  root.querySelector('[data-act="start"]')?.addEventListener('click', async () => {
    const chosen = state.ads.filter((a) => state.selected.has(a.adId));
    if (chosen.length === 0) {
      alert('Niste izbrali nobenega oglasa.');
      return;
    }
    try {
      await rpc('start-renew', {
        ads: chosen,
        pause: state.pause,
        adType: state.adType,
        testMode: state.testMode,
      });
      setView('obnavljanje');
      subscribeToProgress();
    } catch (e) {
      state.adlistError = e.message;
      render();
    }
  });
};

// -------------------------- Obnavljanje view ------------------------------

const STEP_LABELS = {
  starting: 'Začetek',
  'verify-login': 'Preverjanje prijave',
  'scrape-edit-form': 'Branje podatkov vozila',
  'submit-edit': 'Posodabljanje oglasa',
  'scrape-image-urls': 'Branje slik',
  'cache-images': 'Prenos slik',
  'delete-old': 'Brisanje starega oglasa',
  'new-ad-step1': 'Nov oglas (1/3)',
  'click-supurl': 'Nov oglas (2/3)',
  'fill-form-first-pass': 'Polnjenje obrazca',
  'fill-form-and-submit': 'Oddaja obrazca',
  'upload-images': 'Nalaganje slik',
  pause: 'Pavza',
  done: 'Končano',
  cancelled: 'Preklicano',
};

const renderObnavljanje = () => {
  const s = state.jobState;
  if (!s) return `<div class="spinner-msg">Nalagam stanje…</div>`;

  const total = s.total || 0;
  const pct = total ? Math.round((s.current / total) * 100) : 0;
  const stepLabel = STEP_LABELS[s.step] || s.step || '...';
  const pauseSec = Math.ceil((s.pauseRemainingMs || 0) / 1000);
  const testSuffix = s.testMode ? ' (Testni način)' : '';

  if (s.status === 'completed') {
    return `
      <h2 class="title">Obnavljanje zaključeno</h2>
      <p>Vsi izbrani oglasi so bili obnovljeni.</p>
      <button class="btn subtle" data-act="back">Nazaj na glavno stran</button>
    `;
  }
  if (s.status === 'cancelled') {
    return `
      <h2 class="title">Obnavljanje preklicano</h2>
      <p>Postopek je bil preklican.</p>
      <button class="btn subtle" data-act="back">Nazaj na glavno stran</button>
    `;
  }
  if (s.status === 'error') {
    return `
      <h2 class="title">Napaka</h2>
      <div class="err-box">${escapeHtml(s.error || 'Neznana napaka')}</div>
      <button class="btn subtle" data-act="back">Nazaj na glavno stran</button>
    `;
  }
  if (s.status === 'idle') {
    return `
      <div class="spinner-msg">Trenutno ni aktivnega obnavljanja.</div>
      <button class="btn subtle" data-act="back">Nazaj</button>
    `;
  }

  return `
    <h2 class="title">Obnavljam${testSuffix}</h2>
    <div class="section">
      <p>
        Oglas <span class="bold">${s.current}</span> / ${total}
        ${s.currentAdId ? `(ID ${escapeHtml(s.currentAdId)})` : ''}
      </p>
      <p>Korak: <span class="bold">${escapeHtml(stepLabel)}</span></p>
      ${s.step === 'pause' ? `<p>Pavza: ${pauseSec}s</p>` : ''}
      <div class="progress"><div style="width:${pct}%"></div></div>
      <p style="margin-top:0.5rem;font-size:0.8rem;">
        <span class="bold">Pavza med oglasi:</span> ${s.pauseMinutes} min
      </p>
    </div>
    <button class="btn danger" style="width:100%" data-act="cancel">Prekliči</button>
  `;
};

const wireObnavljanje = () => {
  root.querySelector('[data-act="back"]')?.addEventListener('click', () =>
    setView('menu'),
  );
  root.querySelector('[data-act="cancel"]')?.addEventListener('click', async () => {
    if (confirm('Resnično prekliči obnavljanje?')) {
      await rpc('cancel-job').catch(() => {});
    }
  });
};

// ------------------------------- Router -----------------------------------

const render = () => {
  switch (state.view) {
    case 'settings':
      root.innerHTML = renderSettings();
      wireSettings();
      break;
    case 'adlist':
      root.innerHTML = renderAdlist();
      wireAdlist();
      break;
    case 'obnavljanje':
      root.innerHTML = renderObnavljanje();
      wireObnavljanje();
      break;
    case 'menu':
    default:
      root.innerHTML = renderMenu();
      wireMenu();
      break;
  }
};

// ------------------------------- Loaders ----------------------------------

const loadUser = async () => {
  try {
    const stored = await rpc('get-user-data');
    if (!stored) {
      state.user = null;
      state.loadError = 'Konfiguracija še ni nastavljena.';
      return;
    }
    if (!stored.email) {
      state.user = stored;
      state.loadError = 'V konfiguraciji ni e-pošte.';
      return;
    }
    let user = stored;
    try {
      const meta = await rpc('fetch-user-meta', { email: stored.email });
      user = {
        ...stored,
        subscriptionPaidTo: meta.subscriptionPaidTo,
        brokerId: meta.brokerId,
        hdImages: meta.hdImages || false,
      };
      await rpc('set-user-data', user);
    } catch (e) {
      console.warn('Could not refresh user meta', e);
    }
    state.user = user;
    state.loadError = null;
  } catch (e) {
    state.user = null;
    state.loadError = e.message;
  }
};

const loadAds = async () => {
  state.loadingAds = true;
  state.adlistError = null;
  render();
  try {
    const ads = await rpc('get-ads', { adType: state.adType });
    state.ads = (ads || []).slice().reverse();
  } catch (e) {
    state.adlistError = e.message;
  } finally {
    state.loadingAds = false;
    render();
  }
};

let progressPort = null;

const subscribeToProgress = () => {
  if (progressPort) return;
  progressPort = chrome.runtime.connect({ name: 'job-progress' });
  progressPort.onMessage.addListener((msg) => {
    if (msg.type === 'progress') {
      state.jobState = msg.state;
      if (state.view === 'obnavljanje') render();
    }
  });
  progressPort.onDisconnect.addListener(() => {
    progressPort = null;
  });
};

// --------------------------------- Init -----------------------------------

const init = async () => {
  // First, check if there's a job running — jump straight to progress view.
  try {
    const jobState = await rpc('get-job-state');
    state.jobState = jobState;
    if (jobState && jobState.status === 'running') {
      setView('obnavljanje');
      subscribeToProgress();
      return;
    }
  } catch (e) {
    console.warn('get-job-state failed', e);
  }
  await loadUser();
  setView('menu');
};

init();
