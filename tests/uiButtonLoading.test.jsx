// components/ui/Button.jsx: a loading button keeps keyboard focus (aria-disabled) and ignores clicks.
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from '../components/ui/Button.jsx';

// forwardRef components expose their render function, so the element can be inspected without a DOM.
const buttonElement = props => Button.render({ children: 'Continuar', ...props }, null);

describe('Button while loading', () => {
  it('uses aria-disabled instead of the disabled attribute, so focus stays on it', () => {
    const html = renderToStaticMarkup(React.createElement(Button, { loading: true, children: 'Continuar' }));
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toMatch(/\sdisabled=""/);
  });

  it('blocks the click and cancels the default action', () => {
    const onClick = vi.fn();
    const preventDefault = vi.fn();
    buttonElement({ loading: true, onClick }).props.onClick({ preventDefault });
    expect(onClick).not.toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it('forwards the click when not loading', () => {
    const onClick = vi.fn();
    buttonElement({ onClick }).props.onClick({ preventDefault: vi.fn() });
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('Button with an explicit disabled prop', () => {
  it('keeps the native disabled attribute when not loading', () => {
    const html = renderToStaticMarkup(React.createElement(Button, { disabled: true, children: 'Fichar' }));
    expect(html).toMatch(/\sdisabled=""/);
    expect(html).not.toMatch(/aria-disabled="true"/);
  });
});
