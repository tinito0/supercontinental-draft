// Regression: typing in a field of a dialog (e.g. the marketplace filters) must keep the focus in the
// field. The parent passes a new `onClose` on every render; BaseModal used to re-run its focus effect
// on each of them and move the focus to the first focusable element (the close "X" button), so the
// next key activated the X or a global shortcut and the app navigated back.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { BaseModal } from '../components/ui/BaseModal.jsx';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';

const internals = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

/** Minimal hook runtime with React's effect semantics: an effect re-runs only when its deps change. */
function createRuntime() {
  const slots = [];
  let cursor = 0;
  let pending = [];
  const depsChanged = (a, b) => !a || !b || a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]));
  const dispatcher = {
    useRef: initial => {
      const i = cursor++;
      if (!slots[i]) slots[i] = { current: initial };
      return slots[i];
    },
    useState: initial => {
      const i = cursor++;
      if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[i].value, v => { slots[i].value = typeof v === 'function' ? v(slots[i].value) : v; }];
    },
    useCallback: fn => fn,
    useEffect: (fn, deps) => {
      const i = cursor++;
      const prev = slots[i];
      if (!prev || depsChanged(prev.deps, deps)) pending.push({ i, fn, deps });
    },
  };
  return {
    render(component, props) {
      cursor = 0;
      pending = [];
      const previous = internals.ReactCurrentDispatcher.current;
      internals.ReactCurrentDispatcher.current = dispatcher;
      let out;
      try { out = component(props); } finally { internals.ReactCurrentDispatcher.current = previous; }
      for (const { i, fn, deps } of pending) {
        slots[i]?.cleanup?.();
        const cleanup = fn();
        slots[i] = { deps, cleanup: typeof cleanup === 'function' ? cleanup : undefined };
      }
      return out;
    },
    slots,
  };
}

function fakeElement(tagName, label) {
  const el = { tagName, label, focus: vi.fn(() => { global.document.activeElement = el; }), blur: vi.fn(), click: vi.fn() };
  return el;
}

describe('BaseModal focus while typing in a dialog field', () => {
  let listeners;
  let closeButton;
  let filterInput;
  let trigger;

  beforeEach(() => {
    listeners = {};
    closeButton = fakeElement('BUTTON', 'Cerrar');
    filterInput = fakeElement('INPUT', 'Buscar país');
    trigger = fakeElement('BUTTON', 'Filtros');
    global.HTMLElement = Object;
    global.document = { activeElement: trigger, body: { style: { overflow: '' } } };
    global.window = {
      addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
      removeEventListener: (type, fn) => { listeners[type] = (listeners[type] || []).filter(h => h !== fn); },
    };
  });

  afterEach(() => {
    delete global.document;
    delete global.window;
    delete global.HTMLElement;
  });

  const press = (key, target) => {
    const event = { key, target, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, preventDefault: vi.fn() };
    (listeners.keydown || []).forEach(h => h(event));
    return event;
  };

  function openDialog(runtime, onClose) {
    runtime.render(BaseModal, { isOpen: true, onClose, title: 'Filtros', children: null });
    return onClose;
  }

  function mountWithDialog(onClose) {
    const runtime = createRuntime();
    // Pre-seed the dialog ref (BaseModal's first hook) with a fake dialog: [X button, filter input].
    runtime.slots[0] = { current: { querySelectorAll: () => [closeButton, filterInput], focus: vi.fn() } };
    openDialog(runtime, onClose);
    return runtime;
  }

  it('focuses the first control once when the dialog opens', () => {
    mountWithDialog(vi.fn());
    expect(document.activeElement).toBe(closeButton);
  });

  it('keeps the focus in the field when the parent re-renders with a new onClose (each keystroke)', () => {
    const runtime = mountWithDialog(vi.fn());
    filterInput.focus(); // the user clicks the field and types

    for (const ch of ['x', 'X', 'M', 'e', 'x', 'i', 'c', 'o']) {
      press(ch, document.activeElement);
      // Each keystroke updates the filters in App, which renders the dialog with a brand-new onClose.
      runtime.render(BaseModal, { isOpen: true, onClose: vi.fn(), title: 'Filtros', children: null });
      expect(document.activeElement).toBe(filterInput);
    }
    expect(closeButton.focus).toHaveBeenCalledTimes(1); // only on open, never while typing
  });

  it('Escape inside the field leaves the field and does not close the dialog', () => {
    const onClose = vi.fn();
    mountWithDialog(onClose);
    filterInput.focus();
    press('Escape', filterInput);
    expect(filterInput.blur).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Escape outside a field closes the dialog with the latest onClose', () => {
    const runtime = mountWithDialog(vi.fn());
    const latest = vi.fn();
    runtime.render(BaseModal, { isOpen: true, onClose: latest, title: 'Filtros', children: null });
    closeButton.focus();
    press('Escape', closeButton);
    expect(latest).toHaveBeenCalledTimes(1);
  });

  it('typed letters never reach the global navigation shortcuts while the field keeps the focus', () => {
    const runtime = mountWithDialog(vi.fn());
    const setActiveTab = vi.fn();
    const shortcuts = createRuntime();
    shortcuts.render(useKeyboardShortcuts, { setActiveTab });
    filterInput.focus();

    for (const ch of ['x', 'X', 'm', 'o', 't']) {
      press(ch, document.activeElement);
      runtime.render(BaseModal, { isOpen: true, onClose: vi.fn(), title: 'Filtros', children: null });
    }
    expect(setActiveTab).not.toHaveBeenCalled();

    // Outside a field the shortcut still works as designed.
    closeButton.focus();
    press('m', closeButton);
    expect(setActiveTab).toHaveBeenCalledWith('Marketplace');
  });
});
