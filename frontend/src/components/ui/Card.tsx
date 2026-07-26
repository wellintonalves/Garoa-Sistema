import React, { HTMLAttributes, forwardRef } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  clicavel?: boolean;
  children?: React.ReactNode;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ clicavel = false, className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`card-base ${clicavel ? 'card-clicavel' : ''} ${className}`.trim()}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
