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

  const uploadImages = async ({ cacheKey, expectedCount }) => {
    console.log('[uploadImages] Start', { cacheKey, expectedCount });
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
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

        const count = await imageCache.list(cacheKey);
        if (count === 0) {
          throw new Error(
            `No images cached under ${cacheKey} — refusing to publish no-photo ad`,
          );
        }

        for (let index = 0; index < count; index += 1) {
          await wait(3);

          const fileInput = await findFileInput();
          if (!fileInput) throw new Error('File input not found');

          const blob = await imageCache.getImage(cacheKey, index);
          if (!blob) {
            console.log('[uploadImages] Missing blob, skipping', { index });
            continue;
          }

          const file = new File([blob], `${index}.jpg`, { type: 'image/jpeg' });
          attachFileToInput(fileInput, file);
          console.log('[uploadImages] Uploaded', { index });

          await wait(4);

          const buttons = document.querySelectorAll('.ButtonAddPhoto');
          if (buttons.length > 0) {
            try {
              buttons[0].click();
            } catch (e) {
              console.log('[uploadImages] click error', e.message);
            }
            await wait(4);
          }
        }

        console.log('[uploadImages] Upload complete');
        return { uploaded: count };
      } catch (e) {
        console.log('[uploadImages] attempt failed', {
          attempt,
          error: e.message,
        });
        if (attempt === maxRetries) {
          throw new Error(
            `Failed to upload after ${maxRetries} attempts: ${e.message}`,
          );
        }
        await wait(5);
      }
    }
    return { uploaded: 0 };
  };

  ns.uploadImages = { uploadImages };
})();
