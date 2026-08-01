import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-screen bg-[var(--fundo-app)] flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-[var(--superficie-1)] border border-[var(--erro)] rounded-xl p-8 max-w-md w-full">
            <h2 style={{ fontFamily: 'var(--fonte-serif)', color: 'var(--erro)', fontSize: '20px', fontWeight: 600, marginBottom: '12px' }}>
              Oops! Algo deu errado.
            </h2>
            <p style={{ fontFamily: 'var(--fonte-interface)', color: 'var(--texto-secundario)', fontSize: '14px', marginBottom: '24px' }}>
              Ocorreu um erro inesperado ao carregar esta tela. Já fomos notificados e estamos verificando.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ background: 'var(--amber)', color: '#000', fontWeight: 600, fontFamily: 'var(--fonte-interface)', fontSize: '14px', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', border: 'none' }}
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
