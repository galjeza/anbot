(() => {
  const ns = (window.AnBot = window.AnBot || {});
  const { fetchActiveAds, getCarData, deleteOldAd, createNewAd, uploadImages } =
    ns;

  // RPC handlers map. The background sends { command, payload } and gets
  // { data } or { error } back. Each handler is async.
  const handlers = {
    ping: async () => ({ url: location.href, title: document.title }),

    // Auth (user signs in manually; we only verify the session)
    isAlreadyLoggedIn: async () => ns.loginToAvtonet.isAlreadyLoggedIn(),

    // Active ad listing
    scrapeAdsPage: fetchActiveAds.scrapeCurrentPage,

    // Renew — edit page
    scrapeEditForm: getCarData.scrapeEditForm,
    mutateAndSubmitEdit: getCarData.mutateAndSubmitEdit,

    // Renew — images page
    scrapeImageUrls: getCarData.scrapeImageUrls,
    cacheImages: getCarData.cacheImages,

    // Delete (just an acknowledgment after navigation)
    confirmDelete: deleteOldAd.acknowledge,

    // Create new ad
    createNewAdStep1: createNewAd.createNewAdStep1,
    clickSupurl: createNewAd.clickSupurl,
    fillFormAndSubmit: createNewAd.fillFormAndSubmit,
    fillFormAfterReload: createNewAd.fillFormAfterReload,

    // Upload images
    uploadCachedImages: uploadImages.uploadImages,
  };

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg !== 'object' || !msg.command) return false;
    const handler = handlers[msg.command];
    if (!handler) {
      sendResponse({ error: `Unknown command: ${msg.command}` });
      return false;
    }
    (async () => {
      try {
        const data = await handler(msg.payload || {});
        sendResponse({ data });
      } catch (e) {
        console.error('[AnBot handler error]', msg.command, e);
        sendResponse({ error: e && e.message ? e.message : String(e) });
      }
    })();
    return true; // keep the message channel open for async response
  });

  console.log('[AnBot] Content script ready at', location.href);
})();
