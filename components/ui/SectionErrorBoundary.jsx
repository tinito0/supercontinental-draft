import React, { Component } from 'react';
import { Alert } from './Alert.jsx';

// A stale chunk after a deploy: React caches the rejected lazy(), so retrying in place would throw again.
const CHUNK_ERROR_PATTERN = /dynamically imported module|Importing a module script failed|Loading chunk|Unable to preload CSS/i;

export function isChunkLoadError(error) {
  return CHUNK_ERROR_PATTERN.test(String(error?.message || error || ''));
}

const BUTTON_CLASS = 'btn btn-secondary min-h-11';

/**
 * Contains a render error to one tab or modal so the rest of the draft keeps working.
 * `resetKey` clears the error when it changes (e.g. the active tab); `onClose` adds a "Cerrar" button for modals.
 * Chunk-load errors offer a reload instead of "Reintentar" (vite:preloadError in main.jsx already reloads once).
 */
export class SectionErrorBoundary extends Component {
  state = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error) {
    return { error };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey === state.resetKey) return null;
    return { error: null, resetKey: props.resetKey };
  }

  componentDidCatch(error, errorInfo) {
    console.error('SectionErrorBoundary caught a render error:', error, errorInfo);
  }

  handleRetry = () => this.setState({ error: null });

  // Close first: clearing the error while the modal is still mounted would render the failing child again.
  handleClose = () => {
    this.props.onClose?.();
    this.setState({ error: null });
  };

  handleReload = () => window.location.reload();

  renderFallback() {
    const stale = isChunkLoadError(this.state.error);
    const { onClose, isModal = Boolean(onClose) } = this.props;
    const titleId = isModal ? 'section-error-title' : undefined;
    const alert = (
      // Buttons go under the text, not in Alert's side column: at 360px that column squeezed the title to 4 lines.
      <Alert tone="danger" title={<span id={titleId}>No se pudo mostrar esta sección</span>}>
        <p>{stale ? 'Hay una versión nueva de la app. Recargá para seguir.' : 'Probá de nuevo; el resto del draft sigue funcionando.'}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {stale
            ? <button type="button" onClick={this.handleReload} className={BUTTON_CLASS} autoFocus={isModal}>Recargar</button>
            : <button type="button" onClick={this.handleRetry} className={BUTTON_CLASS} autoFocus={isModal}>Reintentar</button>}
          {onClose && <button type="button" onClick={this.handleClose} className={BUTTON_CLASS}>Cerrar</button>}
        </div>
      </Alert>
    );
    if (!isModal) return <div className="p-4 max-w-2xl mx-auto">{alert}</div>;
    return (
      <div role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="fixed inset-0 z-modal flex items-center justify-center bg-canvas/90 p-4">
        {/* Alert's tint is translucent: an opaque surface keeps the page behind from showing through. */}
        <div className="w-full max-w-lg rounded-xl bg-surface">{alert}</div>
      </div>
    );
  }

  render() {
    return this.state.error ? this.renderFallback() : this.props.children;
  }
}

export default SectionErrorBoundary;
