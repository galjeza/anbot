(() => {
  const ns = (window.AnBot = window.AnBot || {});
  const { wait, randomWait, waitForSelector } = ns.utils;
  const { imageCache } = ns;

  const findFileInput = async (maxAttempts = 5) => {
    for (let i = 0; i < maxAttempts; i += 1) {
      const fi = document.querySelector('input[type=file]');
      if (fi) return fi;
      const btn = document.querySelector('.ButtonAddPhoto');
      if (btn) {
        try {
          btn.click();
        } catch {
          // ignore
        }
      }
      await wait(2);
    }
    return null;
  };

  // Programmatically populate a file <input> with a File built from our cached
  // blob, then dispatch a 'change' event. DataTransfer is the only way to
  // assign files to an input from JS in modern browsers.
  const attachFileToInput = (input, file) => {
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const ensureOnUploadPage = async () => {
    await waitForSelector('.mojtrg, .ButtonAddPhoto, input[type=file]', {
      timeout: 15 * 60 * 1000,
    });

    const selectors = ['.mojtrg', '.ButtonAddPhoto', 'input[type=file]'];
    const found = selectors.some((s) => document.querySelector(s));
    if (!found) throw new Error('Not on the image upload page');
  };

  // Returns the count of images cached under this key. Used by the
  // background to drive the per-image loop.
  const getCachedImageCount = async ({ cacheKey }) => {
    const count = await imageCache.list(cacheKey);
    return { count };
  };

  // One-time prep: ensure we're on the upload page, dismiss the info-icon
  // overlay if present. Avto.net's photo-upload flow navigates after each
  // image, so we keep this step short and idempotent.
  const prepareUploadPage = async () => {
    await ensureOnUploadPage();
    await randomWait(2, 3);
    const infoIcon = document.querySelector('.fa.fa-info-circle.fa-lg');
    if (infoIcon) {
      try {
        infoIcon.click();
      } catch {
        // ignore
      }
      await wait(2);
    }
    return { ok: true };
  };

  // Upload ONE image. The background loops over indices, calling this once
  // per image, then handles the ButtonAddPhoto click + stability wait in
  // between. Splitting the loop keeps every navigation BETWEEN commands
  // instead of mid-handler — so a page reload can no longer orphan the
  // message channel.
  const uploadOneImage = async ({ cacheKey, index }) => {
    await ensureOnUploadPage();
    await wait(2);

    const fileInput = await findFileInput();
    if (!fileInput) throw new Error('File input not found');

    const blob = await imageCache.getImage(cacheKey, index);
    if (!blob) {
      return { uploaded: false, index, reason: 'missing blob' };
    }

    const file = new File([blob], `${index}.jpg`, { type: 'image/jpeg' });
    attachFileToInput(fileInput, file);
    console.log('[uploadOneImage] Attached file', { index });

    // Give the page's onChange XHR a chance to start before we return. We
    // don't await the navigation that may follow — the background will
    // waitForTabStable once we're back.
    await wait(4);
    return { uploaded: true, index };
  };

  ns.uploadImages = { prepareUploadPage, uploadOneImage, getCachedImageCount };
})();
