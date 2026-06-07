import { rpc, goto } from './shared.js';

const emailEl = document.getElementById('email');
const form = document.getElementById('form');
const cancel = document.getElementById('cancel');

(async () => {
  try {
    const ud = await rpc('get-user-data');
    if (ud) emailEl.value = ud.email || '';
  } catch {
    // defaults
  }
})();

form.onsubmit = async (e) => {
  e.preventDefault();
  const existing = (await rpc('get-user-data')) || {};
  await rpc('set-user-data', { ...existing, email: emailEl.value });
  goto('menu');
};

cancel.onclick = () => goto('menu');
