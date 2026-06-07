import { rpc, goto, readState, getCurrentWindowId } from './shared.js';

const root = document.getElementById('root');
const state = readState('obnavljanje');

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );

const STEP_LABELS = {
  starting: 'Začetek',
  'verify-login': 'Preverjanje prijave',
  'scrape-edit-form': 'Branje podatkov vozila',
  'submit-edit': 'Posodabljanje obstoječega oglasa',
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

const renderError = (msg) => {
  root.innerHTML = `
    <div class="err-box">
      <h2 class="title">Napaka pri obnavljanju oglasov</h2>
      <p>${escapeHtml(msg)}</p>
      <button class="btn" id="back">Nazaj na glavno stran</button>
    </div>
  `;
  document.getElementById('back').onclick = () => goto('menu');
};

const renderProgress = (s) => {
  const total = s.total || (state ? state.ads.length : 0);
  const pct = total ? Math.round((s.current / total) * 100) : 0;
  const stepLabel = STEP_LABELS[s.step] || s.step;
  const pauseSec = Math.ceil(s.pauseRemainingMs / 1000);
  const testSuffix = s.testMode ? ' (Testni način)' : '';

  let header;
  let body;

  if (s.status === 'completed') {
    header = 'Obnavljanje zaključeno';
    body = `
      <p>Vsi izbrani oglasi so bili obnovljeni.</p>
      <button class="btn" id="back">Nazaj na glavno stran</button>
    `;
  } else if (s.status === 'cancelled') {
    header = 'Obnavljanje preklicano';
    body = `
      <p>Postopek je bil preklican.</p>
      <button class="btn" id="back">Nazaj na glavno stran</button>
    `;
  } else if (s.status === 'error') {
    header = 'Napaka';
    body = `
      <p class="red">${escapeHtml(s.error || 'Neznana napaka')}</p>
      <button class="btn" id="back">Nazaj na glavno stran</button>
    `;
  } else {
    header = `Obnavljam oglase${testSuffix}`;
    body = `
      <p>Oglas <span class="bold">${s.current}</span> / ${total}
         ${s.currentAdId ? `(ID ${escapeHtml(s.currentAdId)})` : ''}</p>
      <p>Korak: <span class="bold">${escapeHtml(stepLabel || '...')}</span></p>
      ${s.step === 'pause' ? `<p>Pavza: ${pauseSec}s</p>` : ''}
      <div class="progress"><div style="width:${pct}%"></div></div>
      <p style="margin-top:1rem">
        <span class="bold">Pavza:</span> ${s.pauseMinutes} min
      </p>
      <button class="btn danger" id="cancel">Prekliči</button>
    `;
  }

  root.innerHTML = `
    <h2 class="title">${escapeHtml(header)}</h2>
    ${body}
  `;

  document.getElementById('back')?.addEventListener('click', () => goto('menu'));
  document.getElementById('cancel')?.addEventListener('click', async () => {
    if (confirm('Resnično prekliči obnavljanje?')) {
      await rpc('cancel-job');
    }
  });
};

const init = async () => {
  if (!state || !state.ads || state.ads.length === 0) {
    renderError('Niste izbrali nobenega oglasa.');
    return;
  }

  // Open a stream to background for live updates.
  const port = chrome.runtime.connect({ name: 'job-progress' });
  port.onMessage.addListener((msg) => {
    if (msg.type === 'progress') {
      renderProgress(msg.state);
    }
  });

  try {
    const windowId = await getCurrentWindowId();
    await rpc('start-renew', {
      ads: state.ads,
      pause: state.pause,
      adType: state.adType,
      testMode: state.testMode,
      windowId,
    });
  } catch (e) {
    renderError(e.message);
  }
};

init();
