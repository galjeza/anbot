// Helpers shared by every extension page. Bridges to the background service
// worker via chrome.runtime.sendMessage.

export const rpc = (name, payload) =>
  new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ rpc: name, payload }, (response) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      if (!response) {
        return reject(new Error(`No response from ${name}`));
      }
      if (response.error) {
        return reject(new Error(response.error));
      }
      resolve(response.data);
    });
  });

export const goto = (page, state = null) => {
  if (state) {
    sessionStorage.setItem(`anbot:state:${page}`, JSON.stringify(state));
  }
  location.href = chrome.runtime.getURL(`pages/${page}.html`);
};

export const readState = (page) => {
  const raw = sessionStorage.getItem(`anbot:state:${page}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const getCurrentWindowId = async () => {
  const w = await chrome.windows.getCurrent();
  return w.id;
};
