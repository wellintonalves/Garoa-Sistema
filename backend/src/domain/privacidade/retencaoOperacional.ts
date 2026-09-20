import { toBrasiliaDate } from '../../lib/timezone';

/** Doze meses de calendário após fim do acesso; não é prazo legal nem autorização de exclusão. */
export function prazoRetencaoFinanceira(fimAcessoEm: Date): Date {
  if (!(fimAcessoEm instanceof Date) || Number.isNaN(fimAcessoEm.getTime())) throw new Error('Fim do acesso inválido.');
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(fimAcessoEm);
  const numero = (tipo: string) => Number(partes.find(p => p.type === tipo)!.value);
  const ano = numero('year') + 1, mes = numero('month');
  const dia = Math.min(numero('day'), new Date(Date.UTC(ano, mes, 0)).getUTCDate());
  const pad = (n: number) => String(n).padStart(2, '0');
  const prazo = toBrasiliaDate(`${ano}-${pad(mes)}-${pad(dia)}T${pad(numero('hour'))}:${pad(numero('minute'))}:${pad(numero('second'))}`);
  prazo.setUTCMilliseconds(fimAcessoEm.getUTCMilliseconds());
  return prazo;
}

export function avaliarRetencaoFinanceira(fimAcessoEm: Date, agora: Date, retencaoLegal: boolean) {
  if (retencaoLegal) return 'RETENCAO_LEGAL_REVISAVEL' as const;
  return agora < prazoRetencaoFinanceira(fimAcessoEm) ? 'RETENCAO_OPERACIONAL' as const : 'REVISAO_NECESSARIA' as const;
}
