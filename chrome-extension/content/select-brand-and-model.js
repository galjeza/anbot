(() => {
  const ns = (window.AnBot = window.AnBot || {});
  const { wait, selectOption } = ns.utils;

  const selectBrand = async (carData, adType) => {
    const select = document.querySelector('select[name=znamka]');
    if (!select) throw new Error('Brand select not found');
    const options = Array.from(select.options).map((o) => o.value);
    console.log('[selectBrand] Options loaded', { count: options.length });

    let znamkaData = carData.find((d) => d.name === 'znamka');
    if (!znamkaData && adType === 'dostavna') {
      znamkaData = carData.find((d) => d.name === 'znamkaTEMP');
      if (znamkaData) console.log('[selectBrand] Using znamkaTEMP');
    }
    if (!znamkaData) throw new Error(`znamka field not found for adType: ${adType}`);

    if (!options.includes(znamkaData.value)) {
      const normalized = znamkaData.value.replaceAll(' ', '');
      console.log('[selectBrand] Trying normalized', { normalized });
      selectOption(select, normalized);
    } else {
      selectOption(select, znamkaData.value);
    }

    await wait(3);
  };

  const resolveModelValue = (carData, adType, modelRelatedFields) => {
    console.log('[resolveModelValue]', {
      adType,
      modelRelatedCount: modelRelatedFields.length,
    });
    if (adType === 'dostavna') {
      const modelTEMP = carData.find((d) => d.name === 'modelTEMP');
      if (!modelTEMP) {
        const model = carData.find((d) => d.name === 'model');
        if (model) return model.value;
        throw new Error('Neither modelTEMP nor model found for dostavna');
      }
      return modelTEMP.value;
    }
    const model = carData.find((d) => d.name === 'model');
    if (!model) throw new Error('model field not found for car ad');
    return model.value;
  };

  const selectModel = async (carModel) => {
    const select = document.querySelector('select[name=model]');
    if (!select) throw new Error('Model select not found');
    const options = Array.from(select.options).map((o) => o.value);
    console.log('[selectModel] Options loaded', { count: options.length });

    const normalize = (v) =>
      String(v || '')
        .trim()
        .toLowerCase()
        .replace(/\(vsi\)/g, '')
        .replace(/[^a-z0-9]/g, '');

    const requested = String(carModel || '').trim();
    const weirdName = requested.replaceAll(' ', '---');

    const directMatch = options.find((v) => v === requested);
    const dashedMatch = options.find((v) => v === weirdName);
    const normalizedRequested = normalize(requested);
    const normalizedMatch = options.find(
      (v) => normalize(v) === normalizedRequested && !v.includes('(vsi)'),
    );

    const selected = directMatch || dashedMatch || normalizedMatch;
    if (!selected) {
      throw new Error(`[selectModel] Could not resolve "${requested}"`);
    }
    console.log('[selectModel] Selecting', { selected });
    selectOption(select, selected);
    await wait(3);
  };

  ns.selectBrandAndModel = { selectBrand, resolveModelValue, selectModel };
})();
