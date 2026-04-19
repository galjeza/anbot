import fs from 'fs';
import path from 'path';
import { app } from 'electron';

import { steelClient } from '../utils/browser-utils.js';
import { getAdImagesDirectory, wait, randomWait } from '../utils/utils.js';

const SLOW_TIMEOUT_MS = 15 * 60 * 1000;

export const uploadImages = async (
  browser,
  carData,
  adType = 'car',
  sessionId,
) => {
  const userDataPath = app.getPath('userData');
  const maxRetries = 3;
  let retryCount = 0;
  const uploadedFilesByLocalPath = new Map();

  if (!sessionId) {
    throw new Error('Steel session ID is required for image uploads');
  }

  const resolveUploadPage = async () => {
    const pages = await browser.pages();
    if (pages.length === 0) {
      throw new Error('No browser pages available for image upload');
    }

    const avtoNetPages = pages.filter((page) => {
      try {
        const pageUrl = page.url();
        return pageUrl.includes('avto.net') && pageUrl !== 'about:blank';
      } catch {
        return false;
      }
    });

    return avtoNetPages[0] || pages[0];
  };

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
      const imagesUploadPage = await resolveUploadPage();

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

      for (const imageFile of imageFiles) {
        await wait(3);
        if (imagesUploadPage.isClosed()) {
          throw new Error('Image upload page was closed');
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

        let sessionImagePath = uploadedFilesByLocalPath.get(imagePath);
        if (!sessionImagePath) {
          const uploadedSessionFile = await steelClient.sessions.files.upload(
            sessionId,
            {
              file: fs.createReadStream(imagePath),
            },
          );

          if (!uploadedSessionFile?.path) {
            throw new Error(
              `Failed to upload image to Steel session: ${imageFile}`,
            );
          }

          sessionImagePath = uploadedSessionFile.path;
          uploadedFilesByLocalPath.set(imagePath, sessionImagePath);

          console.log('[uploadImages] Uploaded file to Steel session', {
            imageFile,
            sessionImagePath,
          });
        }

        console.log('[uploadImages] Uploading file', {
          imageFile,
          sessionImagePath,
        });
        await fileInput.uploadFile(sessionImagePath);
        await wait(2);

        const addPhotoButtons = await imagesUploadPage.$$('.ButtonAddPhoto');
        if (addPhotoButtons.length > 0) {
          console.log('[uploadImages] Clicking add photo button');
          await addPhotoButtons[0].click().catch(() => {});
          await wait(4);
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
