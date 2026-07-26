import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle, WarningCircle, Warning, Info, X } from '@phosphor-icons/react';

export type TipoToast = 'sucesso' | 'erro' | 'aviso' | 'info';

export interface ToastMessage {
  id: string;
  mensagem: string;
  tipo?: TipoToast;
  duracao?: number;
}

export interface ToastProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  const { id, mensagem, tipo = 'info', duracao = 4000 } = toast;

  useEffect(() => {
    if (duracao <= 0) return;
    const timer = setTimeout(() => {
      onClose(id);
    }, duracao);
    return () => clearTimeout(timer);
  }, [id, duracao, onClose]);

  const renderIcon = () => {
    switch (tipo) {
      case 'sucesso':
        return <CheckCircle size={20} weight="regular" style={{ color: 'var(--sucesso)', flexShrink: 0 }} aria-hidden="true" />;
      case 'erro':
        return <WarningCircle size={20} weight="regular" style={{ color: 'var(--erro)', flexShrink: 0 }} aria-hidden="true" />;
      case 'aviso':
        return <Warning size={20} weight="regular" style={{ color: 'var(--aviso)', flexShrink: 0 }} aria-hidden="true" />;
      case 'info':
      default:
        return <Info size={20} weight="regular" style={{ color: 'var(--info)', flexShrink: 0 }} aria-hidden="true" />;
    }
  };

  return (
    <div className={`toast-base toast-${tipo}`} role="alert" aria-live="assertive">
      {renderIcon()}
      <div style={{ flex: 1, fontFamily: 'var(--fonte-sans)', fontSize: '0.875rem', color: 'var(--texto-principal)' }}>
        {mensagem}
      </div>
      <button
        type="button"
        onClick={() => onClose(id)}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--texto-secundario)',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="Fechar toast"
      >
        <X size={18} weight="regular" aria-hidden="true" />
      </button>
    </div>
  );
};

interface ToastContextType {
  addToast: (mensagem: string, tipo?: TipoToast, duracao?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((mensagem: string, tipo: TipoToast = 'info', duracao: number = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, mensagem, tipo, duracao }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="toast-container-desktop">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onClose={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast deve ser usado dentro de um ToastProvider');
  }
  return context;
};
