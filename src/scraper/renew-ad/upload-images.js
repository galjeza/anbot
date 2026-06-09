import fs from 'fs';
import path from 'path';
import { app } from 'electron';

import { getAdImagesDirectory, wait, randomWait } from '../utils/utils.js';

const SLOW_TIMEOUT_MS = 15 * 60 * 1000;

export const uploadImages = async (page, carData, adType = 'car') => {
  const userDataPath = app.getPath('userData');
  const maxRetries = 3;
  let retryCount = 0;

  const getFileInput = async (page) => {
    for (let inputAttempt = 1; inputAttempt <= 5; inputAttempt += 1) {
      const fileInput = await page.$('input[type=file]');
      if (fileInput) {
        return fileInput;
      }

      const addPhotoButton = await page.$('.ButtonAddPhoto');
      if (addPhotoButton) {
        console.log('[uploadImages] Opening upload input', { inputAttempt });
        await addPhotoButton.click().catch(() => {});
      }

      await wait(2);
    }

    return null;
  };

  console.log('[uploadImages] Start', { adType, maxRetries });

  while (retryCount < maxRetries) {
    try {
      console.log('[uploadImages] Attempt', { attempt: retryCount + 1 });
      const imagesUploadPage = page;

      imagesUploadPage.setDefaultTimeout(SLOW_TIMEOUT_MS);
      imagesUploadPage.setDefaultNavigationTimeout(SLOW_TIMEOUT_MS);

      await imagesUploadPage
        .waitForSelector('.mojtrg, .ButtonAddPhoto, input[type=file]', {
          timeout: SLOW_TIMEOUT_MS,
        })
        .catch(() => {});

      // Check if we're on the correct page by looking for multiple possible selectors
      const selectors = ['.mojtrg', '.ButtonAddPhoto', 'input[type=file]'];
      let foundSelector = false;

      for (const selector of selectors) {
        const element = await imagesUploadPage.$(selector);
        if (element) {
          foundSelector = true;
          console.log('[uploadImages] Found selector', { selector });
          break;
        }
      }

      if (!foundSelector) {
        throw new Error('Not on the correct page for image upload');
      }

      await randomWait(2, 3);

      const infoIcon = await imagesUploadPage.$('.fa.fa-info-circle.fa-lg');
      if (infoIcon) {
        await infoIcon.click().catch(() => {});
        await wait(2);
      }

      const adImagesDirectory = getAdImagesDirectory(
        carData,
        userDataPath,
        adType,
      );
      console.log('[uploadImages] Images directory', {
        path: adImagesDirectory,
      });

      // Get all jpg files in the directory and sort them naturally
      const imageFiles = fs
        .readdirSync(adImagesDirectory)
        .filter((file) => file.toLowerCase().endsWith('.jpg'))
        .sort((a, b) => {
          // Extract numbers from filenames if they exist
          const numA = parseInt(a.match(/\d+/)?.[0] || '0');
          const numB = parseInt(b.match(/\d+/)?.[0] || '0');
          return numA - numB;
        });
      console.log('[uploadImages] Files to upload', {
        count: imageFiles.length,
      });

      if (imageFiles.length === 0) {
        throw new Error(
          `[uploadImages] No image files in ${adImagesDirectory} — refusing to publish a no-photo ad`,
        );
      }

      for (const [imgIdx, imageFile] of imageFiles.entries()) {
        await wait(3);
        if (imagesUploadPage.isClosed()) {
          throw new Error('Image upload page was closed');
        }

        try {
          console.log('[uploadImages] Iteration start', {
            imgIdx,
            imageFile,
            url: imagesUploadPage.url(),
            closed: imagesUploadPage.isClosed(),
          });
        } catch (e) {
          console.log('[uploadImages] Iteration start state read failed', e && e.message);
        }

        const fileInput = await getFileInput(imagesUploadPage);
        if (!fileInput) {
          throw new Error('File input not found');
        }

        const imagePath = path.join(adImagesDirectory, imageFile);

        if (!fs.existsSync(imagePath)) {
          console.log('[uploadImages] File missing, skipping', { imageFile });
          continue;
        }

        console.log('[uploadImages] Uploading file', {
          imageFile,
          imagePath,
        });
        await fileInput.uploadFile(imagePath);
        await wait(4);

        // Dump info about every .ButtonAddPhoto so we can see if the click target drifts.
        const buttonDetails = await imagesUploadPage
          .evaluate(() => {
            const btns = Array.from(document.querySelectorAll('.ButtonAddPhoto'));
            return btns.map((el) => ({
              tag: el.tagName,
              type: el.type || null,
              name: el.name || null,
              className: el.className,
              text: (el.textContent || '').trim().slice(0, 80),
              hidden: el.offsetParent === null,
              outer: el.outerHTML.slice(0, 200),
            }));
          })
          .catch((e) => ({ error: e && e.message }));
        console.log('[uploadImages] ButtonAddPhoto candidates', {
          imgIdx,
          buttons: buttonDetails,
        });

        // Count existing thumbnails / file rows so we can see if the page actually
        // accepted the upload before we click again.
        const thumbCount = await imagesUploadPage
          .evaluate(() => ({
            images: document.querySelectorAll('img').length,
            fileInputs: document.querySelectorAll('input[type=file]').length,
            url: location.href,
          }))
          .catch((e) => ({ error: e && e.message }));
        console.log('[uploadImages] Page state after upload', { imgIdx, thumbCount });

        const addPhotoButtons = await imagesUploadPage.$$('.ButtonAddPhoto');
        if (addPhotoButtons.length > 0) {
          console.log('[uploadImages] Clicking add photo button', {
            imgIdx,
            buttonIndex: 0,
            total: addPhotoButtons.length,
          });
          await addPhotoButtons[0].click().catch((e) => {
            console.log('[uploadImages] Click error', { error: e && e.message });
          });
          await wait(4);

          try {
            console.log('[uploadImages] Post-click state', {
              imgIdx,
              url: imagesUploadPage.url(),
              closed: imagesUploadPage.isClosed(),
            });
          } catch (e) {
            console.log('[uploadImages] Post-click state read failed', e && e.message);
          }
        } else {
          console.log('[uploadImages] No ButtonAddPhoto found after upload', { imgIdx });
        }
      }

      console.log('[uploadImages] Upload complete');
      break;
    } catch (error) {
      retryCount++;
      console.log('[uploadImages] Upload attempt failed', {
        error: error.message,
        retryCount,
      });

      if (retryCount === maxRetries) {
        throw new Error(
          `Failed to upload images after ${maxRetries} attempts: ${error.message}`,
        );
      }

      await wait(5);
    }
  }
};
