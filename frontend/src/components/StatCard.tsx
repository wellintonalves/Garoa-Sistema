import { type LucideIcon } from 'lucide-react';

interface StatCardProps {
  titulo: string;
  valor: string;
  icone: LucideIcon;
  subtexto?: string;
  destaque?: boolean;
  alerta?: boolean;
  // Novas props para o Delta
  delta?: number; // porcentagem ou valor, positivo ou negativo
  deltaTipo?: 'alta' | 'baixa' | 'neutro'; // forçado, ou calculado pelo delta
  comparacao?: string; // ex: "vs. mês anterior"
}

export function StatCard({ titulo, valor, icone: Icone, subtexto, alerta, delta, deltaTipo, comparacao }: StatCardProps) {
  // Define o tipo de delta se não for passado explicitamente mas houver valor de delta
  let tipoDeltaCalculado = deltaTipo || 'neutro';
  if (!deltaTipo && delta !== undefined) {
    tipoDeltaCalculado = delta > 0 ? 'alta' : delta < 0 ? 'baixa' : 'neutro';
  }

  const deltaColors = {
    alta: 'var(--sucesso)',
    baixa: 'var(--perigo)',
    neutro: 'var(--texto-secundario)',
  };

  const deltaIcon = {
    alta: '▲',
    baixa: '▼',
    neutro: '-',
  };

  return (
    <div 
      className="animate-fade-in" 
      style={{ 
        background: 'var(--superficie-1)', 
        border: '1px solid var(--borda)', 
        borderRadius: '14px', 
        padding: '16px 20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)', // Shadow base, ideal seria classe, mas manteremos simples
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}
    >
      <div className="flex items-center justify-between">
        <span 
          style={{ 
            fontSize: '11px', 
            textTransform: 'uppercase', 
            letterSpacing: '0.06em', 
            color: 'var(--texto-secundario)', 
            fontWeight: 600 
          }}
        >
          {titulo}
        </span>
        <Icone size={16} style={{ color: 'var(--texto-terciario)' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span 
          style={{ 
            fontFamily: 'var(--fonte-interface)', 
            fontSize: '22px', 
            fontWeight: 700, 
            color: alerta ? 'var(--perigo)' : 'var(--texto-principal)',
            fontVariantNumeric: 'tabular-nums',
            fontFeatureSettings: '"tnum" 1',
            letterSpacing: '-0.01em'
          }}
        >
          {valor}
        </span>
      </div>

      {(delta !== undefined || comparacao || subtexto) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
          {delta !== undefined && (
            <span style={{ fontSize: '12px', fontWeight: 600, color: deltaColors[tipoDeltaCalculado] }}>
              {deltaIcon[tipoDeltaCalculado]} {Math.abs(delta)}%
            </span>
          )}
          {(comparacao || subtexto) && (
            <span style={{ fontSize: '12px', color: 'var(--texto-secundario)' }}>
              {comparacao || subtexto}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
