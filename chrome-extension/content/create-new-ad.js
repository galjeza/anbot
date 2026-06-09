(() => {
  const ns = (window.AnBot = window.AnBot || {});
  const {
    wait,
    waitForSelector,
    selectOption,
    waitForOptionAndSelect,
    triggerClick,
  } = ns.utils;
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
    const oblText = carData.find((d) => d.name === 'oblikaText');
    if (!obl && !oblText) {
      throw new Error('oblika field missing from scraped carData');
    }
    const oblikaSelect = document.querySelector('select[name=oblika]');
    if (!oblikaSelect) {
      throw new Error('oblika select not found on new-ad page');
    }
    // Edit form uses numeric IDs (e.g. "15"), new-ad page uses text labels
    // (e.g. "SUV"). Try the raw value first, then fall back to the text the
    // edit form was displaying.
    const candidates = [obl?.value, oblText?.value].filter(Boolean);
    let picked = null;
    for (const cand of candidates) {
      if (await waitForOptionAndSelect(oblikaSelect, cand, { timeout: 5000 })) {
        picked = cand;
        break;
      }
    }
    if (!picked) {
      const available = Array.from(oblikaSelect.options).map((o) => ({
        value: o.value,
        text: (o.textContent || '').trim(),
      }));
      console.log('[createNewAdStep1] oblika options available', available);
      throw new Error(
        `oblika options ${JSON.stringify(candidates)} never appeared in select. Available: ${available
          .map((a) => a.value)
          .join(', ')}`,
      );
    }

    await setRegistrationMonthYear(carData);
    await setFuelType(carData);

    const potrdi = document.querySelector('button[name="potrdi"]');
    if (!potrdi) throw new Error('Potrdi button missing');
    // Click is performed by the background via chrome.scripting.executeScript
    // after this returns. Keeps the response channel out of the navigation
    // race entirely.
    return { skipped: false };
  };

  // Step 2 only fires for 'car' — click .supurl to expose the full ad form.
  const clickSupurl = async () => {
    await waitForSelector('.supurl', { timeout: 0 });
    const el = document.querySelector('.supurl');
    triggerClick(el);
    console.log('[createNewAd] Clicked supurl');
  };

  // Step 3a: wait for the cena field to be present. The background then
  // triggers chrome.tabs.reload (to settle state, mirroring the original
  // puppeteer flow). Done in background so we never have to await past a
  // navigation in this script (which would orphan sendResponse).
  const waitForCenaInput = async () => {
    await waitForSelector('input[name="cena"], input[name="cenaEURO"]', {
      timeout: 15 * 60 * 1000,
    });
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
    // Background performs the click via chrome.scripting.executeScript after
    // this handler returns; sendResponse fires cleanly first.
    return { ready: true };
  };

  ns.createNewAd = {
    createNewAdStep1,
    clickSupurl,
    waitForCenaInput,
    fillFormAfterReload,
  };
})();
