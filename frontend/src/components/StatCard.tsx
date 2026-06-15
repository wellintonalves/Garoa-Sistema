// Card de estatística (metric-card) — Bebas Neue + DM Mono
import { type LucideIcon } from 'lucide-react';

interface StatCardProps {
  titulo: string;
  valor: string;
  icone: LucideIcon;
  subtexto?: string;
  destaque?: boolean;
}

export function StatCard({ titulo, valor, icone: Icone, subtexto, destaque }: StatCardProps) {
  return (
    <div className="metric-card animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <span className="metric-label">{titulo}</span>
        <div
          className="flex items-center justify-center"
          style={{
            width: '36px',
            height: '36px',
            background: 'rgba(var(--cor-primaria-rgb), 0.15)',
            border: '1px solid rgba(var(--cor-primaria-rgb), 0.3)',
            borderRadius: '4px',
          }}
        >
          <Icone size={16} strokeWidth={1.5} style={{ color: 'var(--cor-icone)' }} />
        </div>
      </div>
      <p className={`metric-value ${destaque ? 'highlight' : ''}`}>{valor}</p>
      {subtexto && (
        <p
          style={{
            fontFamily: 'var(--fonte-interface)',
            fontSize: '10px',
            color: 'var(--text-muted)',
            marginTop: '4px',
            letterSpacing: '0.04em',
          }}
        >
          {subtexto}
        </p>
      )}
    </div>
  );
}
