import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ConflictBanner } from '../components/ui/ConflictBanner.jsx';

describe('components/ui/ConflictBanner', () => {
  it('renders correctly with message and accessibility attributes', () => {
    const message = 'Este jugador fue fichado por otro manager. Actualiza para ver los cambios.';
    const html = renderToString(
      React.createElement(ConflictBanner, {
        message,
        onRefresh: () => {},
        onDismiss: () => {}
      })
    );

    expect(html).toContain(message);
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain('Actualizar');
    expect(html).toContain('Descartar');
  });

  it('returns empty string when visible is false', () => {
    const html = renderToString(
      React.createElement(ConflictBanner, {
        visible: false,
        message: 'Algo cambió'
      })
    );
    expect(html).toBe('');
  });

  it('returns empty string when message is empty or null', () => {
    const html = renderToString(
      React.createElement(ConflictBanner, {
        visible: true,
        message: ''
      })
    );
    expect(html).toBe('');
  });

  it('includes design tokens in style attribute', () => {
    const html = renderToString(
      React.createElement(ConflictBanner, {
        message: 'Conflicto detectado'
      })
    );
    expect(html).toContain('var(--app-warning-muted');
  });

  it('renders custom labels when provided', () => {
    const html = renderToString(
      React.createElement(ConflictBanner, {
        message: 'Conflicto detectado',
        onRefresh: () => {},
        onDismiss: () => {},
        refreshLabel: 'Recargar datos',
        dismissLabel: 'Ignorar'
      })
    );
    expect(html).toContain('Recargar datos');
    expect(html).toContain('Ignorar');
  });
});
