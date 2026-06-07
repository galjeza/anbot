(() => {
  const ns = (window.AnBot = window.AnBot || {});

  const normalize = (s) =>
    s
      .toLowerCase()
      .replace(/\s/g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '');

  const buildSimple = (adProperties, adType) => {
    const keys =
      adType === 'platisca'
        ? ['znamka', 'sirina', 'col', 'vijakov', 'premer', 'ET']
        : ['znamkavozila', 'modelvozila', 'letoReg'];
    let s = '';
    adProperties.forEach((p) => {
      if (keys.includes(p.name)) s += p.value;
    });
    return normalize(s);
  };

  const buildLegacyV3 = (adProperties, adType) => {
    const keys =
      adType === 'platisca'
        ? ['znamka', 'sirina', 'col', 'vijakov', 'premer', 'ET']
        : ['znamkavozila', 'modelvozila', 'prevozenikm', 'letoReg'];
    let s = '';
    adProperties.forEach((p) => {
      if (keys.includes(p.name)) s += p.name + p.value;
    });
    return normalize(s);
  };

  const buildLegacyV2 = (adProperties, adType) => {
    const keys =
      adType === 'platisca'
        ? ['znamka', 'sirina', 'col', 'vijakov', 'premer', 'ET']
        : [
            'znamkavozila',
            'modelvozila',
            'prevozenikm',
            'tipvozila',
            'letoReg',
            'cena',
          ];
    let s = '';
    adProperties.forEach((p) => {
      if (keys.includes(p.name)) s += p.name + p.value;
    });
    return normalize(s);
  };

  const buildLegacyV1 = (adProperties, adType) => {
    const keys =
      adType === 'platisca'
        ? ['znamka', 'sirina', 'col', 'vijakov', 'premer', 'ET']
        : ['znamkavozila', 'modelvozila', 'prevozenikm', 'tipvozila', 'letoReg'];
    let s = '';
    adProperties.forEach((p) => {
      if (keys.includes(p.name)) s += p.name + p.value;
    });
    return normalize(s);
  };

  // Mirrors src/scraper/utils/utils.js#getAdImagesDirectory priority order.
  // Returns the cache key (string) used to look up images.
  ns.adHash = {
    buildSimple,
    buildLegacyV3,
    buildLegacyV2,
    buildLegacyV1,
    pickCacheKey: async (adProperties, adType, cacheHas) => {
      const candidates = [
        buildLegacyV3(adProperties, adType),
        buildLegacyV2(adProperties, adType),
        buildLegacyV1(adProperties, adType),
        buildSimple(adProperties, adType),
      ];
      for (const key of candidates) {
        if (await cacheHas(key)) return key;
      }
      return buildLegacyV3(adProperties, adType);
    },
  };
})();
