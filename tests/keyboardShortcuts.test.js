import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { KeyboardShortcutsHelp } from '../components/ui/KeyboardShortcutsHelp.jsx';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';

describe('components/ui/KeyboardShortcutsHelp', () => {
  it('returns null when isOpen is false', () => {
    const html = renderToString(
      React.createElement(KeyboardShortcutsHelp, {
        isOpen: false,
        onClose: () => {},
      })
    );
    expect(html).toBe('');
  });

  it('renders correctly with title, shortcuts and Windows/Linux key badges', () => {
    const html = renderToString(
      React.createElement(KeyboardShortcutsHelp, {
        isOpen: true,
        onClose: () => {},
      })
    );

    // Title & subtitle in Spanish
    expect(html).toContain('Atajos de teclado');
    expect(html).toContain('Navegación y acciones rápidas');

    // Windows/Linux specific: MUST have Ctrl+K, NOT Cmd or ⌘
    expect(html).toContain('Ctrl');
    expect(html).not.toContain('Cmd');
    expect(html).not.toContain('⌘');

    // Key badges
    expect(html).toContain('>M<');
    expect(html).toContain('>O<');
    expect(html).toContain('>T<');
    expect(html).toContain('>F<');
    expect(html).toContain('>C<');
    expect(html).toContain('>K<');
    expect(html).toContain('>?<');
    expect(html).toContain('>Shift<');
    expect(html).toContain('>/<');
    expect(html).toContain('>Esc<');

    // Descriptions in Spanish
    expect(html).toContain('Ir a Mercado de pases');
    expect(html).toContain('Ir a Inicio (Overview)');
    expect(html).toContain('Ir a Mi Club (Formación)');
    expect(html).toContain('Abrir filtros de jugadores');
    expect(html).toContain('Alternar Carrito / Mi Club');
    expect(html).toContain('Paleta de comandos rápida');
    expect(html).toContain('Abrir / cerrar esta ayuda');
    expect(html).toContain('Cerrar ventana o modal activo');

    // Keys are rendered as <kbd> with the design-system key style (docs/DESIGN_SYSTEM.md, `.kbd`).
    expect(html).toContain('<kbd');
    expect(html).toContain('kbd');

    // Panel uses the design tokens, not hex literals.
    expect(html).toContain('bg-raised');
    expect(html).not.toContain('bg-[#');
  });
});

describe('hooks/useKeyboardShortcuts', () => {
  let listeners = {};
  let originalWindow;
  let originalDocument;

  beforeEach(() => {
    listeners = {};
    originalWindow = global.window;
    originalDocument = global.document;

    global.window = {
      addEventListener: (type, handler) => {
        listeners[type] = listeners[type] || [];
        listeners[type].push(handler);
      },
      removeEventListener: (type, handler) => {
        if (listeners[type]) {
          listeners[type] = listeners[type].filter(h => h !== handler);
        }
      },
    };

    global.document = {
      activeElement: null,
      body: { style: { overflow: '' } },
    };
  });

  afterEach(() => {
    global.window = originalWindow;
    global.document = originalDocument;
  });

  function triggerKey(keyData) {
    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      shiftKey: false,
      target: { tagName: 'DIV' },
      ...keyData,
    };
    const handlers = listeners['keydown'] || [];
    handlers.forEach(h => h(event));
    return event;
  }

  // Hook runner for node environment
  function runHook(options) {
    let effectCleanup;
    let stateVal = false;
    const mockDispatcher = {
      useState: (init) => {
        stateVal = init;
        const setVal = vi.fn((updater) => {
          stateVal = typeof updater === 'function' ? updater(stateVal) : updater;
          if (options && typeof options.setHelpOpen === 'function') {
            options.setHelpOpen(stateVal);
          }
        });
        return [stateVal, setVal];
      },
      useRef: (initial) => ({ current: initial }),
      useCallback: (fn) => fn,
      useEffect: (fn) => {
        const cleanup = fn();
        if (typeof cleanup === 'function') effectCleanup = cleanup;
      },
    };

    const ReactSharedInternals = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
    const prevDispatcher = ReactSharedInternals.ReactCurrentDispatcher.current;
    ReactSharedInternals.ReactCurrentDispatcher.current = mockDispatcher;

    let result;
    try {
      result = useKeyboardShortcuts(options);
    } finally {
      ReactSharedInternals.ReactCurrentDispatcher.current = prevDispatcher;
    }

    return { result, cleanup: effectCleanup };
  }

  it('triggers M shortcut to navigate to Marketplace', () => {
    const setActiveTab = vi.fn();
    runHook({ setActiveTab });

    const event = triggerKey({ key: 'm' });
    expect(setActiveTab).toHaveBeenCalledWith('Marketplace');
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('triggers O shortcut to navigate to Overview', () => {
    const setActiveTab = vi.fn();
    runHook({ setActiveTab });

    const event = triggerKey({ key: 'o' });
    expect(setActiveTab).toHaveBeenCalledWith('Overview');
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('triggers T shortcut to navigate to My Team', () => {
    const setActiveTab = vi.fn();
    runHook({ setActiveTab });

    const event = triggerKey({ key: 't' });
    expect(setActiveTab).toHaveBeenCalledWith('My Team');
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('triggers F shortcut to open filters modal', () => {
    const openModalRoute = vi.fn();
    runHook({ openModalRoute });

    const event = triggerKey({ key: 'f' });
    expect(openModalRoute).toHaveBeenCalledWith('filters');
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('triggers C shortcut to toggle cart', () => {
    const toggleCart = vi.fn();
    runHook({ toggleCart });

    const event = triggerKey({ key: 'c' });
    expect(toggleCart).toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('triggers ? or Shift+/ to toggle help panel', () => {
    const setHelpOpen = vi.fn();
    runHook({ setHelpOpen });

    // Press ?
    const e1 = triggerKey({ key: '?' });
    expect(e1.preventDefault).toHaveBeenCalled();
    expect(setHelpOpen).toHaveBeenCalledWith(true);

    // Press Shift+/
    const e2 = triggerKey({ key: '/', shiftKey: true });
    expect(e2.preventDefault).toHaveBeenCalled();
  });

  it('does NOT trigger shortcuts when user is typing in INPUT or TEXTAREA', () => {
    const setActiveTab = vi.fn();
    const toggleCart = vi.fn();
    runHook({ setActiveTab, toggleCart });

    // User typing in input
    triggerKey({ key: 'm', target: { tagName: 'INPUT' } });
    expect(setActiveTab).not.toHaveBeenCalled();

    // User typing in textarea
    triggerKey({ key: 'c', target: { tagName: 'TEXTAREA' } });
    expect(toggleCart).not.toHaveBeenCalled();

    // User typing in contenteditable
    triggerKey({ key: 't', target: { tagName: 'DIV', isContentEditable: true } });
    expect(setActiveTab).not.toHaveBeenCalled();
  });

  it('does NOT trigger single-key shortcuts when Ctrl, Alt, or Meta is pressed', () => {
    const toggleCart = vi.fn();
    const openModalRoute = vi.fn();
    runHook({ toggleCart, openModalRoute });

    // Ctrl+C (copy) should NOT toggle cart
    triggerKey({ key: 'c', ctrlKey: true });
    expect(toggleCart).not.toHaveBeenCalled();

    // Ctrl+F (browser search) should NOT open filters modal
    triggerKey({ key: 'f', ctrlKey: true });
    expect(openModalRoute).not.toHaveBeenCalled();

    // Alt+M should not navigate
    triggerKey({ key: 'm', altKey: true });
  });

  it('calls closeAllModals on Escape when help is not open', () => {
    const closeAllModals = vi.fn();
    runHook({ closeAllModals });

    triggerKey({ key: 'Escape' });
    expect(closeAllModals).toHaveBeenCalled();
  });
});
