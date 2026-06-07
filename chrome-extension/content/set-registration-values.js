(() => {
  const ns = (window.AnBot = window.AnBot || {});
  const { wait, selectOption } = ns.utils;

  const setRegistrationMonthYear = async (carData) => {
    const mesec = document.querySelector('select[name="mesec"]');
    const leto = document.querySelector('select[name="leto"]');
    if (!mesec || !leto) {
      throw new Error('Registration selects not found');
    }

    console.log('[setRegistration] Selecting month');
    selectOption(mesec, '06');
    await wait(5);

    try {
      const regYearField = carData.find((d) => d.name === 'letoReg');
      if (!regYearField) throw new Error('letoReg not in carData');
      console.log('[setRegistration] Selecting year', { regYear: regYearField.value });
      selectOption(leto, regYearField.value);
    } catch (e) {
      console.log('[setRegistration] Falling back to NOVO vozilo', e.message);
      selectOption(leto, 'NOVO vozilo');
    }
    await wait(3);
  };

  ns.setRegistrationValues = { setRegistrationMonthYear };
})();
