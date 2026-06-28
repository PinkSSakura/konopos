/** Saisie clavier virtuel dans champs natifs (compatible React / Ant Design) */

function shouldSkipVirtualKeyboard(el) {
  if (!el) return true;
  if (el.dataset?.touchKbSkip === 'true') return true;
  if (el.classList?.contains('pin-keyboard-input')) return true;
  if (el.closest?.('[data-touch-kb-skip="true"]')) return true;
  return false;
}

function isTextField(el) {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag !== 'INPUT') return false;
  const type = (el.getAttribute('type') || 'text').toLowerCase();
  return ['text', 'search', 'email', 'tel', 'url', 'password', ''].includes(type);
}

function isNumericField(el) {
  if (!el || !(el instanceof HTMLElement) || el.tagName !== 'INPUT') return false;
  const type = (el.getAttribute('type') || 'text').toLowerCase();
  return type === 'number' || el.classList.contains('ant-input-number-input');
}

function isEditableField(el) {
  return isTextField(el) || isNumericField(el);
}

export function findEditableTarget(el) {
  if (!el) return null;
  if (shouldSkipVirtualKeyboard(el)) return null;
  if (isEditableField(el)) return el;
  if (el.closest) {
    const affix = el.closest('.ant-input-affix-wrapper')?.querySelector('input, textarea');
    if (isEditableField(affix) && !shouldSkipVirtualKeyboard(affix)) return affix;
    const selectInput = el.closest('.ant-select')?.querySelector('.ant-select-selection-search-input');
    if (isEditableField(selectInput) && !shouldSkipVirtualKeyboard(selectInput)) return selectInput;
  }
  return null;
}

function setNativeValue(el, value) {
  const proto = el instanceof HTMLTextAreaElement
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

export function suppressNativeKeyboard(field) {
  if (!field || field.readOnly || field.disabled) return;
  field.setAttribute('inputmode', 'none');
  field.setAttribute('readonly', 'readonly');
  requestAnimationFrame(() => {
    field.removeAttribute('readonly');
  });
}

export function insertIntoField(el, text) {
  if (!isEditableField(el) || el.readOnly || el.disabled) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const next = el.value.slice(0, start) + text + el.value.slice(end);
  setNativeValue(el, next);
  const pos = start + text.length;
  try {
    el.setSelectionRange(pos, pos);
  } catch {
    /* ignore */
  }
  el.focus();
}

export function backspaceField(el) {
  if (!isEditableField(el) || el.readOnly || el.disabled) return;
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  let next;
  let pos;
  if (start !== end) {
    next = el.value.slice(0, start) + el.value.slice(end);
    pos = start;
  } else if (start > 0) {
    next = el.value.slice(0, start - 1) + el.value.slice(start);
    pos = start - 1;
  } else {
    return;
  }
  setNativeValue(el, next);
  try {
    el.setSelectionRange(pos, pos);
  } catch {
    /* ignore */
  }
  el.focus();
}

export function submitField(el) {
  if (!el) return;
  el.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true })
  );
  const form = el.closest('form');
  if (form) {
    const submit = form.querySelector('[type="submit"]');
    if (submit) submit.click();
  }
}

export function fieldPrefersDigits(field) {
  if (!field) return false;
  const type = (field.getAttribute('type') || 'text').toLowerCase();
  return type === 'number'
    || type === 'tel'
    || field.classList.contains('ant-input-number-input')
    || field.inputMode === 'numeric'
    || field.inputMode === 'decimal';
}

export { isTextField, isEditableField, shouldSkipVirtualKeyboard };
