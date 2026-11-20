import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Une erreur inattendue est survenue.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h1 className="text-lg font-bold text-slate-900">
              B.O.C — Interruption de session
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Une erreur de sécurité ou de synchronisation s’est produite. Rechargez votre espace contrôleur pour reprendre.
            </p>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700 break-words max-h-36 overflow-y-auto">
              {this.state.message}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2.5 rounded-lg bg-blue-700 text-sm font-medium text-white hover:bg-blue-800 transition-colors"
            >
              Recharger B.O.C
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
