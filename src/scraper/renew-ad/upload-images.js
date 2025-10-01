import fs from 'fs';
import path from 'path';
import { app } from 'electron';

import { getAdImagesDirectory, wait, randomWait } from '../utils/utils.js';

export const uploadImages = async (browser, carData) => {
  const userDataPath = app.getPath('userData');
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      let imagesUploadPage = await browser
        .pages()
        .then((pages) => pages[pages.length - 1]);

      // Wait for navigation to complete
      await imagesUploadPage
        .waitForNavigation({ timeout: 30000 })
        .catch(() => {});

      // Check if we're on the correct page by looking for multiple possible selectors
      const selectors = ['.mojtrg', '.ButtonAddPhoto', 'input[type=file]'];
      let foundSelector = false;

      for (const selector of selectors) {
        const element = await imagesUploadPage.$(selector);
        if (element) {
          foundSelector = true;
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

      const adImagesDirectory = getAdImagesDirectory(carData, userDataPath);

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

      for (const imageFile of imageFiles) {
        await wait(3);
        imagesUploadPage = await browser
          .pages()
          .then((pages) => pages[pages.length - 1]);

        // Wait for file input with increased timeout
        await imagesUploadPage.waitForSelector('input[type=file]', {
          timeout: 30000,
          visible: true,
        });

        const fileInput = await imagesUploadPage.$('input[type=file]');
        if (!fileInput) {
          throw new Error('File input not found');
        }

        const imagePath = path.join(adImagesDirectory, imageFile);

        if (!fs.existsSync(imagePath)) {
          continue;
        }

        await fileInput.uploadFile(imagePath);
        await wait(2);

        const addPhotoButtons = await imagesUploadPage.$$('.ButtonAddPhoto');
        if (addPhotoButtons.length > 0) {
          await addPhotoButtons[0].click().catch(() => {});
          await wait(4);
        }
      }

      // If we get here without errors, break the retry loop
      break;
    } catch (error) {
      retryCount++;

      if (retryCount === maxRetries) {
        throw new Error(
          `Failed to upload images after ${maxRetries} attempts: ${error.message}`,
        );
      }

      // Wait before retrying
      await wait(5);
    }
  }
};
