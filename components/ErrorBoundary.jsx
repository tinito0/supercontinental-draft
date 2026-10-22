import React, { Component } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { DRAFT_BASE, isDraftPath } from '../utils/siteRoutes.js';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    // Home of whichever app failed: the draft lives under /draft, the league site at the root.
    window.location.href = isDraftPath(window.location.pathname) ? `${DRAFT_BASE}/` : '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          resetError: this.handleReset,
        });
      }

      return (
        <div className="min-h-screen bg-canvas text-ink-2 flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="w-16 h-16 rounded-2xl bg-danger/10 border border-danger/25 flex items-center justify-center text-danger-soft mb-5 shadow-lg">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <span className="text-[11px] font-bold uppercase tracking-wider text-danger-soft bg-danger/10 px-2.5 py-1 rounded-full border border-danger/20 mb-3">
            Ocurrió un error inesperado
          </span>

          <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight max-w-md">
            {this.props.title || 'Algo no salió como esperábamos'}
          </h1>

          <p className="text-xs sm:text-sm text-ink-3 max-w-md mt-2 mb-6 leading-relaxed">
            {this.props.description || 'La aplicación encontró un problema al renderizar este módulo. Podés reintentar o volver al inicio sin perder tu sesión.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-on-accent font-bold text-xs rounded-xl shadow-lg transition active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reintentar
            </button>
            <button
              type="button"
              onClick={this.handleGoHome}
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-ink border border-line/[0.12] font-bold text-xs rounded-xl transition active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              Ir al Inicio
            </button>
          </div>

          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <details className="mt-8 text-left max-w-xl w-full bg-black/40 border border-line/[0.12] rounded-xl p-4 text-xs font-mono text-danger-soft overflow-x-auto">
              <summary className="cursor-pointer text-ink-3 font-bold hover:text-ink">
                Ver detalles técnicos del error
              </summary>
              <p className="mt-2 text-danger-soft font-semibold">{this.state.error.toString()}</p>
              <pre className="mt-2 text-[11px] text-ink-3 overflow-x-auto">
                {this.state.errorInfo?.componentStack || this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
