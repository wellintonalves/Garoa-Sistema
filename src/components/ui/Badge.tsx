import React, { HTMLAttributes, forwardRef } from 'react';

export type VarianteBadge = 'sucesso' | 'info' | 'aviso' | 'erro' | 'neutro';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variante?: VarianteBadge;
  ponto?: boolean;
  children?: React.ReactNode;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variante = 'neutro', ponto = false, className = '', children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={`badge-base badge-${variante} ${className}`.trim()}
        {...props}
      >
        {ponto && (
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '9999px',
              backgroundColor: 'currentColor',
              display: 'inline-block',
            }}
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
