(() => {
  const ns = (window.AnBot = window.AnBot || {});
  const { triggerClick } = ns.utils;

  const TEXT_TO_RADIO_ID = [
    { match: /diesel|dizel/i, id: 'diesel' },
    { match: /bencin|gasoline|petrol/i, id: 'bencin' },
    { match: /hibrid/i, id: 'hibrid' },
    { match: /e-?pogon|elektro|electric/i, id: 'epogon' },
    { match: /lpg|avtoplin/i, id: 'LPG' },
    { match: /cng|zemeljski/i, id: 'CNG' },
  ];

  const resolveRadioId = (text) => {
    if (!text) return null;
    const hit = TEXT_TO_RADIO_ID.find((m) => m.match.test(text));
    return hit ? hit.id : null;
  };

  const setFuelType = async (carData) => {
    const gorivoText = carData.find((d) => d.name === 'gorivoText');
    const gorivoValue = carData.find((d) => d.name === 'gorivo');
    const radioId = resolveRadioId(gorivoText && gorivoText.value);
    console.log('[setFuelType]', {
      gorivoText: gorivoText?.value,
      gorivoValue: gorivoValue?.value,
      radioId,
    });
    if (!radioId) {
      const dom = Array.from(
        document.querySelectorAll('input[name="gorivo"]'),
      ).map((el) => ({
        id: el.id,
        value: el.value,
        labelText: el.labels?.[0]?.textContent?.trim() || null,
      }));
      console.log('[setFuelType] No match. Page radios:', dom);
      throw new Error(
        `Could not map gorivo text "${gorivoText && gorivoText.value}" to radio`,
      );
    }
    const radio = document.getElementById(radioId);
    if (!radio) throw new Error(`Radio #${radioId} not found on page`);
    triggerClick(radio);
  };

  ns.setFuelType = setFuelType;
})();
