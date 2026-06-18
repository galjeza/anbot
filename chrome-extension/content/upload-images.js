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
  // blob. DataTransfer is the only way to assign files to an input from JS in
  // modern browsers.
  const attachFileToInput = (input, file) => {
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
  };

  const dispatchFileChangeSoon = (input) => {
    // The page may navigate immediately when this event fires. Schedule it so
    // the content-script RPC can respond before Chrome tears down the port.
    setTimeout(() => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, 50);
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
    dispatchFileChangeSoon(fileInput);
    console.log('[uploadOneImage] Attached file', { index });

    // Do not wait here. Avto.net can reload the upload page from the change
    // event; the background waits for that after this response is delivered.
    return { uploaded: true, index };
  };

  ns.uploadImages = { prepareUploadPage, uploadOneImage, getCachedImageCount };
})();
