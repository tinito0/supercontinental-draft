import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { useScrollRestore } from '../hooks/useScrollRestore.js';

function renderHookSSR(hookFn, ...args) {
  let hookResult;
  function TestComponent() {
    hookResult = hookFn(...args);
    return null;
  }
  renderToString(React.createElement(TestComponent));
  return hookResult;
}

describe('hooks/useScrollRestore', () => {
  let mockWindow;
  let mockDocument;
  let rafCallbacks;

  beforeEach(() => {
    rafCallbacks = [];
    mockWindow = {
      scrollY: 0,
      scrollTo: vi.fn(),
      requestAnimationFrame: vi.fn((cb) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      }),
    };

    mockDocument = {
      querySelector: vi.fn(),
    };

    globalThis.window = mockWindow;
    globalThis.document = mockDocument;
    globalThis.requestAnimationFrame = mockWindow.requestAnimationFrame;
  });

  afterEach(() => {
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.requestAnimationFrame;
  });

  const flushRaf = () => {
    while (rafCallbacks.length > 0) {
      const cbs = [...rafCallbacks];
      rafCallbacks.length = 0;
      cbs.forEach(cb => cb());
    }
  };

  it('saves and restores window scroll position when containerSelector is omitted', () => {
    const { saveScroll, restoreScroll } = renderHookSSR(useScrollRestore);

    mockWindow.scrollY = 420;
    saveScroll();

    // Reset window scroll to simulate modal closing reset
    mockWindow.scrollY = 0;

    restoreScroll();
    flushRaf();

    expect(mockWindow.scrollTo).toHaveBeenCalledWith(0, 420);
  });

  it('saves and restores container element scrollTop when valid selector provided', () => {
    const mockContainer = {
      scrollTop: 300,
      scrollHeight: 1500,
      clientHeight: 500,
      closest: vi.fn(),
    };
    mockDocument.querySelector.mockImplementation((selector) => {
      if (selector === '#main-content') return mockContainer;
      return null;
    });

    const { saveScroll, restoreScroll } = renderHookSSR(useScrollRestore, '#main-content');

    saveScroll();
    mockContainer.scrollTop = 0;

    restoreScroll();
    flushRaf();

    expect(mockContainer.scrollTop).toBe(300);
  });

  it('falls back to #main-content when selector points to unscrollable element like #player-list', () => {
    const mainContent = {
      id: 'main-content',
      scrollTop: 670,
      scrollHeight: 2000,
      clientHeight: 800,
    };
    const playerList = {
      id: 'player-list',
      scrollTop: 0,
      scrollHeight: 600,
      clientHeight: 600,
      closest: vi.fn().mockImplementation((selector) => {
        if (selector === '#main-content') return mainContent;
        return null;
      }),
    };

    mockDocument.querySelector.mockImplementation((selector) => {
      if (selector === '#player-list') return playerList;
      if (selector === '#main-content') return mainContent;
      return null;
    });

    const { saveScroll, restoreScroll } = renderHookSSR(useScrollRestore, '#player-list');

    saveScroll();
    mainContent.scrollTop = 0;

    restoreScroll();
    flushRaf();

    expect(mainContent.scrollTop).toBe(670);
  });

  it('gracefully handles missing container by falling back to window', () => {
    mockDocument.querySelector.mockReturnValue(null);
    mockWindow.scrollY = 190;

    const { saveScroll, restoreScroll } = renderHookSSR(useScrollRestore, '#missing');

    saveScroll();
    mockWindow.scrollY = 0;

    restoreScroll();
    flushRaf();

    expect(mockWindow.scrollTo).toHaveBeenCalledWith(0, 190);
  });
});
