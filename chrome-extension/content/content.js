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
    mutateEditForm: getCarData.mutateEditForm,

    // Renew — images page
    scrapeImageUrls: getCarData.scrapeImageUrls,
    cacheImages: getCarData.cacheImages,

    // Delete (just an acknowledgment after navigation)
    confirmDelete: deleteOldAd.acknowledge,

    // Create new ad
    createNewAdStep1: createNewAd.createNewAdStep1,
    clickSupurl: createNewAd.clickSupurl,
    waitForCenaInput: createNewAd.waitForCenaInput,
    fillFormAfterReload: createNewAd.fillFormAfterReload,

    // Upload images — split into prepare + per-image + count so each
    // navigation that the upload page does (it does several) falls
    // BETWEEN commands instead of mid-handler.
    prepareUploadPage: uploadImages.prepareUploadPage,
    uploadOneImage: uploadImages.uploadOneImage,
    getCachedImageCount: uploadImages.getCachedImageCount,
  };

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg !== 'object' || !msg.command) return false;
    const handler = handlers[msg.command];
    if (!handler) {
      sendResponse({ error: `Unknown command: ${msg.command}` });
      return false;
    }
    const verbose = msg.command !== 'ping';
    const t0 = Date.now();
    if (verbose) {
      console.log(`[AnBot] RX ${msg.command} @ ${location.href}`);
    }
    let responded = false;
    const safeSend = (payload) => {
      if (responded) return;
      responded = true;
      try {
        sendResponse(payload);
      } catch (e) {
        console.warn(`[AnBot] sendResponse threw for ${msg.command}:`, e);
      }
    };
    // If the page tears down mid-handler, the unload listener at least logs
    // which command was orphaned so we can correlate with the SW error.
    const onUnload = () => {
      if (!responded) {
        console.warn(
          `[AnBot] page unloaded BEFORE ${msg.command} responded (` +
            `${Date.now() - t0}ms in) — message channel will close`,
        );
      }
    };
    window.addEventListener('beforeunload', onUnload, { once: true });
    (async () => {
      try {
        const data = await handler(msg.payload || {});
        if (verbose) {
          console.log(
            `[AnBot] OK ${msg.command} (${Date.now() - t0}ms) @ ${location.href}`,
          );
        }
        safeSend({ data });
      } catch (e) {
        console.error(
          `[AnBot] ERR ${msg.command} (${Date.now() - t0}ms) @ ${location.href}:`,
          e,
        );
        safeSend({ error: e && e.message ? e.message : String(e) });
      } finally {
        window.removeEventListener('beforeunload', onUnload);
      }
    })();
    return true; // keep the message channel open for async response
  });

  console.log('[AnBot] Content script ready at', location.href);
})();
