export const deleteOldAd = async (browser, adId) => {
  const [page] = await browser.pages();

  console.log('[deleteOldAd] Navigating to delete URL', { adId });

  await page.goto(
    `https://www.avto.net/_2016mojavtonet/ad_delete.asp?id=${adId}`,
    { timeout: 0 },
  );
  console.log('[deleteOldAd] Delete request sent');
};
