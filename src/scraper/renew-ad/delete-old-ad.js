export const deleteOldAd = async (browser, adId) => {
  const [page] = await browser.pages();

  await page.goto(
    `https://www.avto.net/_2016mojavtonet/ad_delete.asp?id=${adId}`,
    { timeout: 0 },
  );
};
