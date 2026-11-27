// SectionErrorBoundary without a DOM (the suite runs in node): the class is driven the way React drives it
// (getDerivedStateFromError / getDerivedStateFromProps / render) and the output is rendered to static markup.
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SectionErrorBoundary, isChunkLoadError } from '../components/ui/SectionErrorBoundary.jsx';

function boundary(props, error = null) {
  const instance = new SectionErrorBoundary(props);
  instance.state = { ...instance.state, ...(error ? SectionErrorBoundary.getDerivedStateFromError(error) : {}) };
  instance.setState = (patch) => { instance.state = { ...instance.state, ...patch }; };
  return instance;
}

const html = (instance) => renderToStaticMarkup(<div>{instance.render()}</div>);

describe('SectionErrorBoundary', () => {
  it('renders children while nothing failed, and the fallback once a child threw', () => {
    const children = <p>contenido</p>;
    expect(html(boundary({ children }))).toContain('contenido');

    const failed = html(boundary({ children }, new Error('boom')));
    expect(failed).not.toContain('contenido');
    expect(failed).toContain('No se pudo mostrar esta sección');
    expect(failed).toContain('Reintentar');
    expect(failed).toContain('min-h-11');
  });

  it('Reintentar renders the children again', () => {
    const instance = boundary({ children: <p>contenido</p> }, new Error('boom'));
    instance.handleRetry();
    expect(html(instance)).toContain('contenido');
  });

  it('clears the error when resetKey changes, and keeps it otherwise', () => {
    const instance = boundary({ resetKey: 'Overview', children: <p>x</p> }, new Error('boom'));
    expect(SectionErrorBoundary.getDerivedStateFromProps({ resetKey: 'Overview' }, instance.state)).toBeNull();
    expect(SectionErrorBoundary.getDerivedStateFromProps({ resetKey: 'Admin' }, instance.state)).toEqual({ error: null, resetKey: 'Admin' });
  });

  it('a modal fallback offers Cerrar, which calls onClose and clears the error', () => {
    const onClose = vi.fn();
    const instance = boundary({ onClose, children: <p>x</p> }, new Error('boom'));
    expect(html(instance)).toContain('Cerrar');
    instance.handleClose();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(instance.state.error).toBeNull();
  });

  it('keeps siblings outside the boundary untouched', () => {
    const failed = boundary({ children: <p>dentro</p> }, new Error('boom'));
    const page = renderToStaticMarkup(<main><nav>menu</nav>{failed.render()}</main>);
    expect(page).toContain('menu');
    expect(page).toContain('No se pudo mostrar esta sección');
  });

  it('a stale chunk offers Recargar instead of Reintentar', () => {
    const error = new TypeError('Failed to fetch dynamically imported module: /assets/x.js');
    expect(isChunkLoadError(error)).toBe(true);
    expect(isChunkLoadError(new Error('boom'))).toBe(false);
    const out = html(boundary({ children: <p>x</p> }, error));
    expect(out).toContain('Recargar');
    expect(out).not.toContain('Reintentar');
  });
});
