(() => {
  const ns = (window.AnBot = window.AnBot || {});

  // The deletion endpoint is a plain GET — navigating the tab to it deletes
  // the ad. The background does the navigation; this command exists only as
  // a marker so the background's command list mirrors the original
  // src/scraper/renew-ad/delete-old-ad.js shape.
  const buildDeleteUrl = (adId) =>
    `https://www.avto.net/_2016mojavtonet/ad_delete.asp?id=${encodeURIComponent(adId)}`;

  const acknowledge = async () => ({ ok: true });

  ns.deleteOldAd = { buildDeleteUrl, acknowledge };
})();
