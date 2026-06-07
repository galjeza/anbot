(() => {
  const ns = (window.AnBot = window.AnBot || {});
  const { wait, selectOption, setNativeInputValue, triggerClick } = ns.utils;

  const fillWysiwygOpis = async (carData) => {
    console.log('[fillWysiwygOpis] Start');
    const source =
      carData.find((d) => d.name === 'htmlOpis') ||
      carData.find((d) => d.name === 'opombe');
    const htmlOpis = source ? source.value : null;
    if (!htmlOpis) {
      console.log('[fillWysiwygOpis] No htmlOpis/opombe value');
      return;
    }

    const textarea =
      document.querySelector('#editor1') ||
      document.querySelector('textarea[name="opombe"]');
    if (textarea) {
      setNativeInputValue(textarea, htmlOpis);
    }

    // CKEditor lives on the host page, so we have to inject the call into the
    // page's main world. Content-script isolation hides window.CKEDITOR from
    // us otherwise.
    const inject = (data) => {
      const tag = document.createElement('script');
      tag.textContent = `
        try {
          if (window.CKEDITOR && window.CKEDITOR.instances && window.CKEDITOR.instances.editor1) {
            window.CKEDITOR.instances.editor1.setData(${JSON.stringify(data)});
          }
        } catch (e) { console.log('[fillWysiwygOpis injection error]', e); }
      `;
      document.documentElement.appendChild(tag);
      tag.remove();
    };
    inject(htmlOpis);

    await wait(2);
  };

  const fillCheckboxesFromData = async (carData) => {
    console.log('[fillCheckboxesFromData] Start');
    const checkboxes = Array.from(document.querySelectorAll('input[type=checkbox]'));
    console.log('[fillCheckboxesFromData] Count', { count: checkboxes.length });

    for (const cb of checkboxes) {
      let entry = carData.find((d) => d.name === cb.name);
      if (!entry && cb.name === 'opombeznamka') {
        entry = carData.find((d) => d.name === `opombeznamka|${cb.value}`);
      }
      if (!entry) continue;
      const shouldBeChecked = entry.value === '1' || entry.value === true;
      if (shouldBeChecked !== cb.checked) {
        triggerClick(cb);
      }
    }
  };

  const fillInputsFromData = async (carData) => {
    console.log('[fillInputsFromData] Start');
    const inputs = Array.from(document.querySelectorAll('input[type=text]'));
    console.log('[fillInputsFromData] Count', { count: inputs.length });

    for (const input of inputs) {
      try {
        const name = input.name;
        const entry = carData.find((d) => d.name === name);
        if (entry && entry.value) {
          setNativeInputValue(input, '');
          setNativeInputValue(input, entry.value);
        }
      } catch {
        // skip
      }
    }
  };

  const fillSelectsFromData = async (carData) => {
    console.log('[fillSelectsFromData] Start');
    const selects = Array.from(document.querySelectorAll('select'));
    console.log('[fillSelectsFromData] Count', { count: selects.length });

    for (const sel of selects) {
      try {
        const name = sel.name;
        const entry = carData.find((d) => d.name === name);
        if (entry && entry.value) {
          selectOption(sel, entry.value);
        }
      } catch {
        // skip
      }
    }
  };

  const fillTextareasFromData = async (carData) => {
    console.log('[fillTextareasFromData] Start');
    const textareas = Array.from(document.querySelectorAll('textarea'));
    console.log('[fillTextareasFromData] Count', { count: textareas.length });

    for (const ta of textareas) {
      try {
        const name = ta.name;
        // Skip the WYSIWYG-bound textarea; fillWysiwygOpis handles it.
        if (name === 'opombe') continue;
        const entry = carData.find((d) => d.name === name);
        if (entry && entry.value) {
          setNativeInputValue(ta, entry.value);
        }
      } catch {
        // skip
      }
    }
  };

  ns.fillFormFields = {
    fillWysiwygOpis,
    fillCheckboxesFromData,
    fillInputsFromData,
    fillSelectsFromData,
    fillTextareasFromData,
  };
})();
