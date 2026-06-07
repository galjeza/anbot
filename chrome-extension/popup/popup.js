document.getElementById('open').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ rpc: 'open-dashboard' });
  window.close();
});
