import type { ElementType } from 'react';
import { TrendUp, TrendDown } from '@phosphor-icons/react';
import { Sparkline } from './Sparkline';
import { formatarDelta } from '../../utils/formato';

export interface CardMetricaProps {
  titulo: string;
  valor: string;
  delta?: number | null;
  comparacao?: string;
  rotuloComparativo?: string;
  serie?: number[];
  subtexto?: string;
  icone?: ElementType;
  destaque?: boolean;
  alerta?: boolean;
}

export function CardMetrica({
  titulo,
  valor,
  delta,
  comparacao = 'vs. período anterior',
  rotuloComparativo,
  serie,
  subtexto,
  icone: Icone,
  destaque,
  alerta,
}: CardMetricaProps) {
  const temDelta = delta !== undefined && delta !== null && Number.isFinite(delta);
  const subiu = temDelta && delta! > 0;
  const caiu = temDelta && delta! < 0;

  const corDelta = subiu
    ? 'var(--sucesso)'
    : caiu
    ? 'var(--erro)'
    : 'var(--texto-secundario)';

  const textoDelta = temDelta ? formatarDelta(delta) : '—';
  const textoComparacao = temDelta ? (rotuloComparativo || comparacao) : 'sem dados no período anterior';

  return (
    <div
      className={`animate-fade-in flex flex-col justify-between p-5 rounded-[var(--raio-xl)] bg-[var(--fundo-superficie)] border ${destaque ? 'border-[var(--cor-primaria)]' : 'border-[var(--borda-sutil)]'} shadow-[var(--sombra-1)] gap-3 transition-all`}
      style={{ fontFamily: 'var(--fonte-interface)' }}
    >
      <div className="flex items-center justify-between">
        <span
          className="font-medium tracking-wide"
          style={{
            fontSize: 'var(--texto-detalhe, 13px)',
            color: 'var(--texto-secundario)',
          }}
        >
          {titulo}
        </span>
        {Icone && <Icone size={18} style={{ color: 'var(--texto-terciario)' }} />}
      </div>

      <div className="flex items-center justify-between gap-4 my-1">
        <span
          className="font-bold tabular-nums tracking-tight text-[1.75rem] leading-none"
          style={{
            fontFamily: 'var(--fonte-mono, monospace)',
            color: alerta ? 'var(--erro, var(--perigo))' : 'var(--texto-principal)',
          }}
        >
          {valor}
        </span>
        {serie && Array.isArray(serie) && serie.length >= 2 && (
          <Sparkline dados={serie} cor={corDelta} />
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[var(--borda-sutil)]">
        {delta !== undefined && (
          <>
            <span
              className="inline-flex items-center gap-1 font-semibold text-xs tabular-nums"
              style={{ color: corDelta }}
            >
              {subiu && <TrendUp size={14} weight="bold" />}
              {caiu && <TrendDown size={14} weight="bold" />}
              {textoDelta}
            </span>
            <span
              className="text-xs"
              style={{ color: 'var(--texto-secundario)' }}
            >
              {textoComparacao}
            </span>
          </>
        )}
        {subtexto && (
          <span className="text-xs ml-auto" style={{ color: 'var(--texto-secundario)' }}>
            {subtexto}
          </span>
        )}
      </div>
    </div>
  );
}
