(() => {
  const ns = (window.AnBot = window.AnBot || {});
  const { wait, waitForSelector, selectOption, triggerClick } = ns.utils;
  const { selectBrand, resolveModelValue, selectModel } = ns.selectBrandAndModel;
  const { setRegistrationMonthYear } = ns.setRegistrationValues;
  const setFuelType = ns.setFuelType;
  const {
    fillWysiwygOpis,
    fillCheckboxesFromData,
    fillInputsFromData,
    fillSelectsFromData,
    fillTextareasFromData,
  } = ns.fillFormFields;
  const solveCaptcha = ns.solveCaptcha;

  // Step 1: brand / model / body / registration / fuel + click potrdi. After
  // potrdi the form navigates to a different page; the background waits for
  // that navigation. For platisca this step is a no-op (returns "skipped").
  const createNewAdStep1 = async ({ carData, adType }) => {
    if (adType === 'platisca') {
      return { skipped: true };
    }

    await waitForSelector('select[name=znamka]', { timeout: 0 });

    const modelRelatedFields = carData.filter(
      (d) =>
        d.name.toLowerCase().includes('model') ||
        d.name.toLowerCase().includes('tip') ||
        d.name.toLowerCase().includes('type'),
    );

    await selectBrand(carData, adType);
    const carModel = resolveModelValue(carData, adType, modelRelatedFields);
    await selectModel(carModel);

    const obl = carData.find((d) => d.name === 'oblika');
    if (obl) {
      const select = document.querySelector('select[name=oblika]');
      if (select) selectOption(select, obl.value);
    }

    await setRegistrationMonthYear(carData);
    await setFuelType(carData);

    const potrdi = document.querySelector('button[name="potrdi"]');
    if (!potrdi) throw new Error('Potrdi button missing');
    triggerClick(potrdi);
    await wait(5);
    return { skipped: false };
  };

  // Step 2 only fires for 'car' — click .supurl to expose the full ad form.
  const clickSupurl = async () => {
    await waitForSelector('.supurl', { timeout: 0 });
    const el = document.querySelector('.supurl');
    triggerClick(el);
    console.log('[createNewAd] Clicked supurl');
  };

  // Step 3: page reload to settle state, then fill out every field and
  // submit. After submit the page navigates to the photo upload page.
  const fillFormAndSubmit = async ({ carData, adType }) => {
    await waitForSelector('input[name="cena"], input[name="cenaEURO"]', {
      timeout: 15 * 60 * 1000,
    });
    // Original puppeteer flow reloaded once to settle state — mirror that.
    location.reload();
    // Reload kills this script, so just exit — the background calls
    // fillFormAfterReload once the new page is ready.
  };

  const fillFormAfterReload = async ({ carData, adType }) => {
    await waitForSelector('input[name="cena"], input[name="cenaEURO"]', {
      timeout: 15 * 60 * 1000,
    });

    await fillWysiwygOpis(carData);
    await fillCheckboxesFromData(carData);
    await fillInputsFromData(carData);
    await fillSelectsFromData(carData);
    await fillTextareasFromData(carData);

    const vin = carData.find((d) => d.name === 'VINobjavi');
    if (adType === 'car' && vin) {
      const shouldBeChecked = vin.value === '1';
      const cb = document.querySelector('#VINobjavi');
      if (cb && shouldBeChecked !== cb.checked) {
        triggerClick(cb);
      }
    }

    await solveCaptcha();

    const submit = document.querySelector('button[name="EDITAD"]');
    if (!submit) throw new Error('EDITAD submit button missing');
    triggerClick(submit);
  };

  ns.createNewAd = {
    createNewAdStep1,
    clickSupurl,
    fillFormAndSubmit,
    fillFormAfterReload,
  };
})();
