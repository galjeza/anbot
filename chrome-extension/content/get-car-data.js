(() => {
  const ns = (window.AnBot = window.AnBot || {});
  const { wait, waitForSelector, clickAndType } = ns.utils;
  const { adHash, imageCache, imageProcess, solveCaptcha } = ns;

  // Step 1: scrape every form field off the edit page and return a flat
  // [{ name, value }, …] array. The background passes this back into other
  // commands later. The edit-form mutation + submit + image scrape happen in
  // separate commands so each survives a service-worker restart.
  const scrapeEditForm = async ({ adId }) => {
    await waitForSelector('button[name=ADVIEW]', { timeout: 0 });
    await wait(3);

    const textAreas = Array.from(document.querySelectorAll('textarea')).map(
      (t) => ({ name: t.name, value: t.value }),
    );

    const checkboxes = Array.from(
      document.querySelectorAll('input[type=checkbox]'),
    ).map((input) => {
      const baseName = input.name;
      const augmentedName =
        baseName === 'opombeznamka' && input.value
          ? `${baseName}|${input.value}`
          : baseName;
      return {
        name: augmentedName,
        value: input.checked ? '1' : '0',
      };
    });

    const selects = Array.from(document.querySelectorAll('select')).map((sel) => {
      const opt = sel.options[sel.selectedIndex];
      return {
        name: sel.name,
        value: sel.value,
        selectedText: opt ? (opt.textContent || '').trim() : null,
      };
    });

    const inputs = Array.from(document.querySelectorAll('input')).map((i) => ({
      name: i.name,
      value: i.value,
    }));

    const htmlOpisField = textAreas.find((t) => t.name === 'opombe');
    const htmlOpis = htmlOpisField ? htmlOpisField.value : null;

    const gorivoSelect = selects.find((s) => s.name === 'gorivo');
    const extraSelects = [...selects];
    if (gorivoSelect && gorivoSelect.selectedText) {
      extraSelects.push({
        name: 'gorivoText',
        value: gorivoSelect.selectedText,
      });
    }

    const carData = [
      ...textAreas,
      ...checkboxes,
      ...extraSelects.map(({ name, value }) => ({ name, value })),
      ...inputs,
      { name: 'htmlOpis', value: htmlOpis },
    ];

    console.log('[scrapeEditForm] Scraped', {
      adId,
      fields: carData.length,
      textAreas: textAreas.length,
      checkboxes: checkboxes.length,
      selects: selects.length,
      inputs: inputs.length,
    });

    return carData;
  };

  const randomPriceOffset = () => {
    const offset = Math.floor(Math.random() * 50) + 1;
    return Math.random() < 0.5 ? -offset : offset;
  };

  const randomRegistrationYear = () => {
    const currentYear = new Date().getFullYear();
    const minYear = currentYear - 20;
    return String(
      Math.floor(Math.random() * (currentYear - minYear + 1)) + minYear,
    );
  };

  // Step 2: adjust price + registration year on the live edit page, solve
  // the captcha, and submit. Caller (background) will wait for navigation
  // afterwards.
  const mutateAndSubmitEdit = async ({ carData }) => {
    const priceInput = document.querySelector('input[name="cena"]');
    if (priceInput) {
      const original = parseInt(priceInput.value, 10) || 1000;
      const newPrice = Math.max(100, original + randomPriceOffset());
      console.log('[mutateEdit] Adjusting price', { original, newPrice });
      await clickAndType(priceInput, String(newPrice));
    }

    const yearInput = document.querySelector('input[name="letoReg"]');
    if (yearInput) {
      const newYear = randomRegistrationYear();
      console.log('[mutateEdit] Adjusting registration year', {
        original: yearInput.value,
        newYear,
      });
      await clickAndType(yearInput, newYear);
    }

    await wait(3);
    await solveCaptcha();

    const submit = document.querySelector('button[name=ADVIEW]');
    if (!submit) throw new Error('Edit form submit button missing');
    submit.click();
    await wait(3);
  };

  // Step 3: on the images page, pull the image URLs that point at
  // images.avto.net and (optionally) swap them to the _HD variants.
  const scrapeImageUrls = async ({ hdImages }) => {
    await wait(3);
    const allImgSrcs = Array.from(document.querySelectorAll('img')).map(
      (img) => img.src,
    );
    let images = allImgSrcs.filter((src) => src.includes('images.avto.net'));
    if (images.length === 0) {
      throw new Error(
        '[scrapeImageUrls] No images on this page — refusing to proceed before destructive steps',
      );
    }
    images = images.map((src) => src.replace('_160', ''));
    if (hdImages) {
      images = images.map((src) => src.replace('.jpg', '_HD.jpg'));
    }
    console.log('[scrapeImageUrls] Found image URLs', { count: images.length });
    return images;
  };

  // Step 4: download images into IndexedDB. Lives in the content script so we
  // can keep the avto.net origin for fetches (no CORS) and pass blobs around
  // without round-tripping through the background service worker.
  const cacheImages = async ({ carData, imageUrls, hdImages, adType }) => {
    const adProps = [...carData, { name: 'images', value: imageUrls }];
    const cacheKey = await adHash.pickCacheKey(adProps, adType, (key) =>
      imageCache.has(key),
    );

    if (await imageCache.has(cacheKey)) {
      const count = await imageCache.list(cacheKey);
      console.log('[cacheImages] Cache hit', { cacheKey, count });
      return { cacheKey, downloaded: false, count };
    }

    console.log('[cacheImages] Downloading', {
      cacheKey,
      count: imageUrls.length,
    });

    let written = 0;
    for (const [index, url] of imageUrls.entries()) {
      try {
        const resp = await fetch(url, {
          credentials: 'omit',
          headers: { 'User-Agent': navigator.userAgent },
        });
        if (!resp.ok) {
          console.log('[cacheImages] Skipping failed image', {
            url,
            status: resp.status,
          });
          continue;
        }
        let blob = await resp.blob();
        if (!hdImages) {
          try {
            blob = await imageProcess.reduceSharpnessDesaturateAndBlurEdges(
              blob,
            );
          } catch (e) {
            console.log('[cacheImages] Image processing failed, using original', {
              url,
              error: e.message,
            });
          }
        }
        await imageCache.putImage(cacheKey, index, blob);
        written += 1;
      } catch (e) {
        console.log('[cacheImages] Download error', { url, error: e.message });
      }
    }

    if (written === 0) {
      throw new Error('No images downloaded — aborting');
    }

    await imageCache.setManifest(cacheKey, written);
    return { cacheKey, downloaded: true, count: written };
  };

  ns.getCarData = {
    scrapeEditForm,
    mutateAndSubmitEdit,
    scrapeImageUrls,
    cacheImages,
  };
})();
