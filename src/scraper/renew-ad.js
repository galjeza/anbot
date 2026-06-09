import { setupLocalBrowser } from './utils/local-browser-utils.js';
import { loginToAvtonet } from './renew-ad/login-to-avtonet.js';
import { getCarData } from './renew-ad/get-car-data.js';
import { deleteOldAd } from './renew-ad/delete-old-ad.js';
import { createNewAd } from './renew-ad/create-new-ad.js';
import { uploadImages } from './renew-ad/upload-images.js';

const SLOW_TIMEOUT_MS = 15 * 60 * 1000;

export const renewAd = async (
  adId,
  email,
  password,
  hdImages,
  adType,
  testMode = false,
) => {
  console.log('[RenewAd] Start', {
    adId,
    adType,
    hdImages,
    testMode,
  });
  const { page, release } = await setupLocalBrowser();
  try {
    page.setDefaultTimeout(SLOW_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(SLOW_TIMEOUT_MS);
    console.log('[RenewAd] Browser ready');
    await loginToAvtonet(page, email, password);
    console.log('* Logged in successfully');
    const carData = await getCarData(page, adId, hdImages, adType, testMode);
    console.log('* Fetched car data successfully');
    if (testMode) {
      console.log('* Test mode: skipping deleteOldAd');
    } else {
      await deleteOldAd(page, adId);
      console.log('* Deleted old ad successfully');
    }
    await createNewAd(page, carData, adType);
    console.log('* Created new ad successfully');
    await uploadImages(page, carData, adType);
    console.log('* Uploaded images successfully');
    console.log('[RenewAd] Done', { adId });
  } finally {
    await release().catch(() => undefined);
  }
};

const renewAds = async (adIds, email, password) => {
  console.log('[RenewAds] Batch start', { count: adIds.length });
  for (const adId of adIds) {
    console.log('[RenewAds] Renewing ad', { adId });
    await renewAd(adId, email, password);
  }
  console.log('[RenewAds] Batch complete');
};
