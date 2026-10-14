import React, { Component } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

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
    window.location.href = '/';
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
        <div className="min-h-screen bg-[#06080d] text-slate-200 flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400 mb-5 shadow-lg">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <span className="text-[11px] font-black uppercase tracking-wider text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20 mb-3">
            Ocurrió un error inesperado
          </span>

          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight max-w-md">
            {this.props.title || 'Algo no salió como esperábamos'}
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 max-w-md mt-2 mb-6 leading-relaxed">
            {this.props.description || 'La aplicación encontró un problema al renderizar este módulo. Podés reintentar o volver al inicio sin perder tu sesión.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-5 py-2.5 bg-[#00b4d8] hover:bg-[#38bdf8] text-[#030712] font-black text-xs rounded-xl shadow-lg transition active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reintentar
            </button>
            <button
              type="button"
              onClick={this.handleGoHome}
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold text-xs rounded-xl transition active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              Ir al Inicio
            </button>
          </div>

          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <details className="mt-8 text-left max-w-xl w-full bg-black/40 border border-white/10 rounded-xl p-4 text-xs font-mono text-red-300 overflow-x-auto">
              <summary className="cursor-pointer text-slate-400 font-bold hover:text-white">
                Ver detalles técnicos del error
              </summary>
              <p className="mt-2 text-red-400 font-semibold">{this.state.error.toString()}</p>
              <pre className="mt-2 text-[11px] text-slate-500 overflow-x-auto">
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
