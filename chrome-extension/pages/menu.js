import { rpc, goto } from './shared.js';

const root = document.getElementById('root');

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );

const render = ({ user, error }) => {
  if (error) {
    root.innerHTML = `
      <div class="err-box">
        <h2 class="title">Napaka</h2>
        <p>${escapeHtml(error)}</p>
        <button class="btn" id="settings">Odpri konfiguracijo</button>
      </div>
    `;
    document.getElementById('settings').onclick = () => goto('settings');
    return;
  }

  const subDate = user?.subscriptionPaidTo
    ? new Date(user.subscriptionPaidTo)
    : null;
  const isActive = subDate && subDate > new Date();
  const subDateStr = subDate
    ? subDate.toLocaleString('sl-SI', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '-';

  root.innerHTML = `
    <h2 class="title">Avtonet Bot - Obnavljanje oglasov</h2>
    <div class="section">
      <p><span class="bold">Email:</span> ${escapeHtml(user?.email ?? '-')}</p>
      <p><span class="bold">Naročnina aktivna do:</span> ${escapeHtml(subDateStr)}</p>
      <p>
        <span class="bold">Status naročnine:</span>
        <span class="${isActive ? 'green' : 'red'}">
          ${isActive ? 'Aktivna' : 'Neaktivna'}
        </span>
      </p>
    </div>
    <div class="section">
      <button class="btn subtle" id="settings">Konfiguracija</button>
      ${
        isActive
          ? `
        <button class="btn subtle" data-adtype="car">Obnovi avtomobile</button>
        <button class="btn subtle" data-adtype="dostavna">Obnovi dostavna vozila</button>
        <button class="btn subtle" data-adtype="platisca">Obnovi platišča</button>
      `
          : `<p class="red">Obnova oglasov ni mogoča saj nimate aktivne naročnine</p>`
      }
    </div>
  `;

  document.getElementById('settings').onclick = () => goto('settings');
  document.querySelectorAll('[data-adtype]').forEach((btn) => {
    btn.onclick = () => goto('adlist', { adType: btn.dataset.adtype });
  });
};

const init = async () => {
  try {
    const stored = await rpc('get-user-data');
    if (!stored) {
      render({ user: null, error: 'Konfiguracija še ni nastavljena.' });
      return;
    }
    if (!stored.email) {
      render({
        user: stored,
        error: 'V konfiguraciji ni e-pošte. Prosim, vnesite jo.',
      });
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

    render({ user });
  } catch (e) {
    render({ user: null, error: e.message });
  }
};

init();
