(() => {
  const ns = (window.AnBot = window.AnBot || {});
  const { wait, waitForSelector, waitForFunction } = ns.utils;

  const RESULTS_ROW_SELECTOR = '.GO-Results-Row';
  const NEXT_BUTTON_SELECTOR = '.GO-Rounded-R';
  const DEFAULT_TIMEOUT_MS = 60_000;

  const PRICE_SELECTORS = [
    '.GO-Results-Price-Mid',
    '.GO-Results-Price-Mid-Akcija',
    '.GO-Results-Price-TXT-Regular',
    '.GO-Results-Price-TXT-AkcijaCena',
    '.GO-Results-Price',
  ];

  // Scrape one results page. Background drives the navigation between pages
  // so the per-call surface stays small and the script restarts cleanly when
  // the URL changes.
  const scrapeCurrentPage = async () => {
    await waitForSelector(RESULTS_ROW_SELECTOR, { timeout: DEFAULT_TIMEOUT_MS });
    await waitForFunction(
      () => {
        const images = Array.from(
          document.querySelectorAll(`${RESULTS_ROW_SELECTOR} img`),
        );
        return images.some((img) => {
          const src = img.getAttribute('src');
          return src && !src.startsWith('data:');
        });
      },
      { timeout: DEFAULT_TIMEOUT_MS },
    );

    const rows = document.querySelectorAll(RESULTS_ROW_SELECTOR);
    const ads = [];

    for (const row of rows) {
      const photoEl = row.querySelector('.GO-Results-Photo');
      if (!photoEl) continue;

      const nameEl = row.querySelector('.GO-Results-Naziv');
      const name = nameEl ? nameEl.innerText.trim() : '';

      const img = photoEl.querySelector('img');
      const photoUrl = img ? img.getAttribute('src') || '' : '';

      const anchor = photoEl.querySelector('a');
      const adUrl = anchor ? anchor.getAttribute('href') || '' : '';
      if (!adUrl) continue;

      let price = '';
      for (const sel of PRICE_SELECTORS) {
        const node = row.querySelector(sel);
        if (node && node.innerText.trim()) {
          price = node.innerText.trim();
          break;
        }
      }

      if (!price || price === 'PRODANO') continue;

      ads.push({
        name,
        price,
        photoUrl,
        adUrl,
        adId: adUrl.split('=')[1] || '',
      });
    }

    const nextBtn = document.querySelector(NEXT_BUTTON_SELECTOR);
    let nextUrl = null;
    if (nextBtn && !nextBtn.classList.contains('disabled')) {
      const a = nextBtn.querySelector('a');
      if (a && a.href) nextUrl = a.href;
    }

    return { ads, nextUrl };
  };

  ns.fetchActiveAds = { scrapeCurrentPage };
})();
