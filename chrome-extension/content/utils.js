(() => {
  const ns = (window.AnBot = window.AnBot || {});

  const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

  const randomWait = (min, max) => {
    const t = Math.random() * (max - min) + min;
    return wait(t);
  };

  // Puppeteer convention: timeout === 0 means "wait forever".
  const waitForSelector = async (selector, { timeout = 60000, root = document } = {}) => {
    const start = Date.now();
    while (timeout === 0 || Date.now() - start < timeout) {
      const el = root.querySelector(selector);
      if (el) return el;
      await wait(0.1);
    }
    throw new Error(`Timeout waiting for selector: ${selector}`);
  };

  const waitForFunction = async (fn, { timeout = 60000, interval = 0.1 } = {}) => {
    const start = Date.now();
    while (timeout === 0 || Date.now() - start < timeout) {
      const result = fn();
      if (result) return result;
      await wait(interval);
    }
    throw new Error('Timeout waiting for function');
  };

  // Use the native setter so React-style frameworks pick the change up.
  const setNativeInputValue = (input, value) => {
    const proto =
      input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // Roughly equivalent to puppeteer's page.type with a per-character delay.
  const typeIntoInput = async (input, value, { delay = 50 } = {}) => {
    input.focus();
    setNativeInputValue(input, '');
    const text = String(value ?? '');
    for (const ch of text) {
      setNativeInputValue(input, input.value + ch);
      await wait(delay / 1000);
    }
  };

  const clearInput = (input) => {
    input.focus();
    setNativeInputValue(input, '');
  };

  const clickAndType = async (input, value, opts) => {
    input.focus();
    clearInput(input);
    await typeIntoInput(input, value, opts);
  };

  const selectOption = (selectEl, value) => {
    selectEl.value = value;
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // Poll until the <select> has an <option> with the given value, then
  // select it. Useful when the options are populated by an async cascade
  // (e.g. oblika after model). Returns true on success, false on timeout.
  const waitForOptionAndSelect = async (
    selectEl,
    value,
    { timeout = 15000 } = {},
  ) => {
    const start = Date.now();
    const target = String(value);
    while (Date.now() - start < timeout) {
      const hasOption = Array.from(selectEl.options).some(
        (o) => o.value === target,
      );
      if (hasOption) {
        selectOption(selectEl, target);
        return true;
      }
      await wait(0.2);
    }
    return false;
  };

  const triggerClick = (el) => {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    el.click();
  };

  ns.utils = {
    wait,
    randomWait,
    waitForSelector,
    waitForFunction,
    setNativeInputValue,
    typeIntoInput,
    clearInput,
    clickAndType,
    selectOption,
    waitForOptionAndSelect,
    triggerClick,
  };
})();
