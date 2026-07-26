import React, { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef, useId } from 'react';
import { AlertCircle } from 'lucide-react';

export interface CampoWrapperProps {
  label?: string;
  erro?: string;
  hint?: string;
  id?: string;
  children: React.ReactNode;
  className?: string;
}

export const Campo: React.FC<CampoWrapperProps> = ({
  label,
  erro,
  hint,
  id,
  children,
  className = '',
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className={`campo-container ${className}`.trim()}>
      {label && (
        <label htmlFor={inputId} className="campo-label">
          {label}
        </label>
      )}
      {children}
      <div className="campo-msg-reserva" role="alert" aria-live="polite">
        {erro ? (
          <>
            <AlertCircle size={16} strokeWidth={1.75} aria-hidden="true" />
            <span>{erro}</span>
          </>
        ) : hint ? (
          <span style={{ color: 'var(--texto-terciario)' }}>{hint}</span>
        ) : null}
      </div>
    </div>
  );
};

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  erro?: string;
  hint?: string;
  iconeEsquerda?: React.ReactNode;
  iconeDireita?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, erro, hint, iconeEsquerda, iconeDireita, className = '', id, style, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    const inputElement = (
      <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
        {iconeEsquerda && (
          <span
            style={{
              position: 'absolute',
              left: 'var(--espaco-3)',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--texto-terciario)',
              pointerEvents: 'none',
            }}
          >
            {iconeEsquerda}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`campo-input ${erro ? 'campo-erro' : ''} ${className}`.trim()}
          style={{
            paddingLeft: iconeEsquerda ? 'calc(var(--espaco-3) + 24px)' : undefined,
            paddingRight: iconeDireita ? 'calc(var(--espaco-3) + 24px)' : undefined,
            ...style,
          }}
          aria-invalid={!!erro}
          {...props}
        />
        {iconeDireita && (
          <span
            style={{
              position: 'absolute',
              right: 'var(--espaco-3)',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--texto-terciario)',
            }}
          >
            {iconeDireita}
          </span>
        )}
      </div>
    );

    if (!label && !erro && !hint) {
      return inputElement;
    }

    return (
      <Campo label={label} erro={erro} hint={hint} id={inputId}>
        {inputElement}
      </Campo>
    );
  }
);

Input.displayName = 'Input';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  erro?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, erro, hint, className = '', id, children, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id || generatedId;

    const selectElement = (
      <select
        ref={ref}
        id={selectId}
        className={`campo-input ${erro ? 'campo-erro' : ''} ${className}`.trim()}
        aria-invalid={!!erro}
        {...props}
      >
        {children}
      </select>
    );

    if (!label && !erro && !hint) {
      return selectElement;
    }

    return (
      <Campo label={label} erro={erro} hint={hint} id={selectId}>
        {selectElement}
      </Campo>
    );
  }
);

Select.displayName = 'Select';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  erro?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, erro, hint, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id || generatedId;

    const textareaElement = (
      <textarea
        ref={ref}
        id={textareaId}
        className={`campo-input campo-textarea ${erro ? 'campo-erro' : ''} ${className}`.trim()}
        aria-invalid={!!erro}
        {...props}
      />
    );

    if (!label && !erro && !hint) {
      return textareaElement;
    }

    return (
      <Campo label={label} erro={erro} hint={hint} id={textareaId}>
        {textareaElement}
      </Campo>
    );
  }
);

Textarea.displayName = 'Textarea';
