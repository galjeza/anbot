import { setupBrowser } from './utils/browser-utils.js';
import { loginToAvtonet } from './renew-ad/login-to-avtonet.js';
import { getCarData } from './renew-ad/get-car-data.js';
import { deleteOldAd } from './renew-ad/delete-old-ad.js';
import { createNewAd } from './renew-ad/create-new-ad.js';
import { uploadImages } from './renew-ad/upload-images.js';

export const renewAd = async (adId, email, password, hdImages, adType) => {
  const browser = await setupBrowser();
  await loginToAvtonet(browser, email, password);
  const carData = await getCarData(browser, adId, hdImages);
  console.log('Car data: ', carData);
  console.log('Successfully got the car data ');
  console.log('Email: ', email);
  console.log('Passwrod: ', password);
  // await deleteOldAd(browser, adId);
  await createNewAd(browser, carData, adType);
  console.log('Successfully created the new ad');
  // await uploadImages(browser, carData);
  await browser.close();
};

const renewAds = async (adIds, email, password) => {
  for (const adId of adIds) {
    await renewAd(adId, email, password);
  }
};
