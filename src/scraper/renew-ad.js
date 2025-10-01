import { setupBrowser } from './utils/browser-utils.js';
import { loginToAvtonet } from './renew-ad/login-to-avtonet.js';
import { getCarData } from './renew-ad/get-car-data.js';
import { deleteOldAd } from './renew-ad/delete-old-ad.js';
import { createNewAd } from './renew-ad/create-new-ad.js';
import { uploadImages } from './renew-ad/upload-images.js';

export const renewAd = async (adId, email, password, hdImages, adType) => {
  const browser = await setupBrowser();
  await loginToAvtonet(browser, email, password);
  console.log('* Logged in successfully');
  const carData = await getCarData(browser, adId, hdImages, adType);
  console.log('* Fetched car data successfully');
  await deleteOldAd(browser, adId);
  console.log('* Deleted old ad successfully');
  await createNewAd(browser, carData, adType);
  console.log('* Created new ad successfully');
  await uploadImages(browser, carData, adType);
  console.log('* Uploaded images successfully');
  await browser.close();
};

const renewAds = async (adIds, email, password) => {
  for (const adId of adIds) {
    await renewAd(adId, email, password);
  }
};
