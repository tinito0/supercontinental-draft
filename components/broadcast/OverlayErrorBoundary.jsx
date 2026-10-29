import { Component } from 'react';

// Corta los errores de una capa del overlay de OBS. El ErrorBoundary de la app dibuja una página opaca de error:
// en una fuente de OBS eso salía al aire encima del juego hasta que alguien refrescaba la fuente. Acá la capa que
// falla queda transparente (nada en pantalla), se reintenta sola y vuelve también cuando cambian los datos.

export const OVERLAY_RETRY_MS = 5000;

/**
 * @param {{ name: string, resetKey?: unknown, children: React.ReactNode }} props
 *   resetKey: cuando cambia (llegan datos nuevos) se vuelve a intentar enseguida.
 */
export class OverlayErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failedKey: null, hasError: false };
    this.retryTimer = null;
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  static getDerivedStateFromProps(props, state) {
    if (state.hasError && state.failedKey !== null && !Object.is(props.resetKey, state.failedKey)) {
      return { hasError: false, failedKey: null };
    }
    return null;
  }

  componentDidCatch(error) {
    console.error(`[overlay:${this.props.name}]`, error);
    this.setState({ failedKey: this.props.resetKey ?? null });
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.setState({ hasError: false, failedKey: null }), OVERLAY_RETRY_MS);
  }

  componentWillUnmount() {
    clearTimeout(this.retryTimer);
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

export default OverlayErrorBoundary;
