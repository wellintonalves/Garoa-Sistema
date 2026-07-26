import React, { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes, forwardRef } from 'react';

export interface TabelaProps extends HTMLAttributes<HTMLTableElement> {
  children?: React.ReactNode;
}

export const Tabela = forwardRef<HTMLTableElement, TabelaProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <table
          ref={ref}
          style={{ width: '100%', borderCollapse: 'collapse', borderSpacing: 0 }}
          className={className}
          {...props}
        >
          {children}
        </table>
      </div>
    );
  }
);

Tabela.displayName = 'Tabela';

export const TabelaCabecalho = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = '', children, ...props }, ref) => (
    <thead ref={ref} className={`tabela-cabecalho ${className}`.trim()} {...props}>
      {children}
    </thead>
  )
);
TabelaCabecalho.displayName = 'TabelaCabecalho';

export const TabelaCorpo = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className = '', children, ...props }, ref) => (
    <tbody ref={ref} className={className} {...props}>
      {children}
    </tbody>
  )
);
TabelaCorpo.displayName = 'TabelaCorpo';

export const TabelaLinha = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className = '', children, ...props }, ref) => (
    <tr ref={ref} className={`tabela-linha ${className}`.trim()} {...props}>
      {children}
    </tr>
  )
);
TabelaLinha.displayName = 'TabelaLinha';

export type TipoColuna = 'texto' | 'monetario' | 'hora' | 'numero';

export interface TabelaCabecalhoCelulaProps extends ThHTMLAttributes<HTMLTableCellElement> {
  tipo?: TipoColuna;
}

export const TabelaCabecalhoCelula = forwardRef<HTMLTableCellElement, TabelaCabecalhoCelulaProps>(
  ({ tipo = 'texto', className = '', children, style, ...props }, ref) => {
    const ehMono = tipo === 'monetario' || tipo === 'hora' || tipo === 'numero';
    return (
      <th
        ref={ref}
        className={`tabela-celula ${ehMono ? 'tabela-celula-mono' : ''} ${className}`.trim()}
        style={{
          fontWeight: 500,
          color: 'var(--texto-secundario)',
          textAlign: ehMono ? 'right' : 'left',
          ...style,
        }}
        {...props}
      >
        {children}
      </th>
    );
  }
);
TabelaCabecalhoCelula.displayName = 'TabelaCabecalhoCelula';

export interface TabelaCelulaProps extends TdHTMLAttributes<HTMLTableCellElement> {
  tipo?: TipoColuna;
}

export const TabelaCelula = forwardRef<HTMLTableCellElement, TabelaCelulaProps>(
  ({ tipo = 'texto', className = '', children, ...props }, ref) => {
    const ehMono = tipo === 'monetario' || tipo === 'hora' || tipo === 'numero';
    return (
      <td
        ref={ref}
        className={`tabela-celula ${ehMono ? 'tabela-celula-mono' : ''} ${className}`.trim()}
        {...props}
      >
        {children}
      </td>
    );
  }
);
TabelaCelula.displayName = 'TabelaCelula';
