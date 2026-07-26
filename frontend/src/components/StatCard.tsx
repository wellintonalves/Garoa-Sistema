import type { ElementType } from 'react';
import { CardMetrica } from './ui/CardMetrica';

interface StatCardProps {
  titulo: string;
  valor: string;
  icone: ElementType;
  subtexto?: string;
  destaque?: boolean;
  alerta?: boolean;
  delta?: number;
  deltaTipo?: 'alta' | 'baixa' | 'neutro';
  comparacao?: string;
  serie?: number[];
}

export function StatCard({
  titulo,
  valor,
  icone,
  subtexto,
  destaque,
  alerta,
  delta,
  comparacao,
  serie,
}: StatCardProps) {
  return (
    <CardMetrica
      titulo={titulo}
      valor={valor}
      icone={icone}
      subtexto={subtexto}
      destaque={destaque}
      alerta={alerta}
      delta={delta}
      comparacao={comparacao}
      serie={serie}
    />
  );
}
