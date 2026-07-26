import React, { ButtonHTMLAttributes, forwardRef } from 'react';

export type VarianteBotao = 'primario' | 'secundario' | 'fantasma' | 'inverso' | 'destrutivo';

export interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao;
  loading?: boolean;
  children?: React.ReactNode;
}

export const Botao = forwardRef<HTMLButtonElement, BotaoProps>(
  ({ variante = 'primario', loading = false, disabled, className = '', children, ...props }, ref) => {
    const estaDesabilitado = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={estaDesabilitado}
        className={`btn-base btn-${variante} ${className}`.trim()}
        {...props}
      >
        <span style={{ visibility: loading ? 'hidden' : 'visible', display: 'inline-flex', alignItems: 'center', gap: 'var(--espaco-2)' }}>
          {children}
        </span>
        {loading && (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              className="spinner-ds"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </span>
        )}
      </button>
    );
  }
);

Botao.displayName = 'Botao';
