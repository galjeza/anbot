// Maps the gorivo text label scraped from the edit page (or a few common
// numeric-code fallbacks) onto the new-ad page's radio input id.
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

export const setFuelType = async (page, carData) => {
  const gorivoText = carData.find((d) => d.name === 'gorivoText');
  const gorivoValue = carData.find((d) => d.name === 'gorivo');

  const fromText = resolveRadioId(gorivoText && gorivoText.value);
  console.log('[setFuelType] Selecting fuel type', {
    gorivoText: gorivoText ? gorivoText.value : null,
    gorivoValue: gorivoValue ? gorivoValue.value : null,
    resolvedRadioId: fromText,
  });

  if (!fromText) {
    // Dump the page DOM so we can extend the mapping if a new fuel type appears.
    const dom = await page.evaluate(() =>
      Array.from(document.querySelectorAll('input[name="gorivo"]')).map((el) => ({
        id: el.id,
        value: el.value,
        labelText: el.labels && el.labels[0] ? el.labels[0].textContent.trim() : null,
      })),
    );
    console.log('[setFuelType] No match for scraped gorivo text. Page radios:', dom);
    throw new Error(
      `Could not map gorivo text "${gorivoText && gorivoText.value}" to a fuel-type radio`,
    );
  }

  await page.click(`#${fromText}`);
};
