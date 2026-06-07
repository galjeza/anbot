import { rpc, goto, readState, getCurrentWindowId } from './shared.js';

const root = document.getElementById('root');
const state = readState('adlist') || { adType: 'car' };
const adType = state.adType;

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );

const trunc = (s, n = 35) => (s.length > n ? `${s.slice(0, n)}...` : s);

let ads = [];
let selected = new Set();
let pause = 60;
let testMode = false;
let selectAll = false;

const renderError = (msg) => {
  root.innerHTML = `
    <div class="err-box">
      <h2 class="title">Napaka pri nalaganju oglasov</h2>
      <p>${escapeHtml(msg)}</p>
      <button class="btn" id="back">Nazaj na glavno stran</button>
    </div>
  `;
  document.getElementById('back').onclick = () => goto('menu');
};

const render = () => {
  root.innerHTML = `
    <div class="controls-bar">
      <button class="btn" id="submit">Obnovi izbrane oglase</button>
      <label>
        <span class="lbl">Pavza (min)</span>
        <input type="number" id="pause" value="${pause}" min="0" />
      </label>
      <label>
        <input type="checkbox" id="selectAll" ${selectAll ? 'checked' : ''} />
        <span class="lbl">Izberi vse</span>
      </label>
      <label>
        <input type="checkbox" id="testMode" ${testMode ? 'checked' : ''} />
        <span class="lbl">Testni način (ne izbriši starega oglasa)</span>
      </label>
    </div>
    <div class="ad-grid" id="grid">
      ${ads
        .map(
          (ad) => `
        <div class="ad-card">
          <img src="${escapeHtml(ad.photoUrl)}" alt="${escapeHtml(ad.name)}" />
          <div class="name" title="${escapeHtml(ad.name)}">
            ${escapeHtml(trunc(ad.name))}
          </div>
          <div class="price">${escapeHtml(ad.price)}</div>
          <label>
            <input type="checkbox" data-adid="${escapeHtml(ad.adId)}" ${selected.has(ad.adId) ? 'checked' : ''} />
          </label>
        </div>
      `,
        )
        .join('')}
    </div>
  `;

  document.getElementById('pause').oninput = (e) => {
    pause = Number(e.target.value) || 0;
  };
  document.getElementById('selectAll').onchange = (e) => {
    selectAll = e.target.checked;
    selected = selectAll ? new Set(ads.map((a) => a.adId)) : new Set();
    render();
  };
  document.getElementById('testMode').onchange = (e) => {
    testMode = e.target.checked;
  };

  document
    .querySelectorAll('input[data-adid]')
    .forEach((cb) => {
      cb.onchange = () => {
        const id = cb.dataset.adid;
        if (cb.checked) selected.add(id);
        else selected.delete(id);
        selectAll = selected.size === ads.length;
      };
    });

  document.getElementById('submit').onclick = async () => {
    const chosen = ads.filter((a) => selected.has(a.adId));
    if (chosen.length === 0) {
      alert('Niste izbrali nobenega oglasa.');
      return;
    }
    goto('obnavljanje', {
      ads: chosen,
      pause,
      adType,
      testMode,
    });
  };
};

(async () => {
  try {
    const windowId = await getCurrentWindowId();
    const fetched = await rpc('get-ads', { adType, windowId });
    ads = (fetched || []).slice().reverse();
    render();
  } catch (e) {
    renderError(e.message);
  }
})();
