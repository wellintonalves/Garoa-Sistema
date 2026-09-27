import { diaBrasiliaStr, inicioDiaBrasilia } from '../../lib/timezone';

export function referenciaTemporalIa(agora: Date) {
  const hoje = diaBrasiliaStr(agora);
  // Aritmética do calendário local, sem usar o fuso do processo.
  const calendario = new Date(`${hoje}T12:00:00Z`);
  calendario.setUTCDate(calendario.getUTCDate() - calendario.getUTCDay());
  return { fuso: 'America/Sao_Paulo', agora: agora.toISOString(), hoje,
    inicioMes: `${hoje.slice(0, 7)}-01`, inicioSemana: calendario.toISOString().slice(0, 10), semanaComeca: 'domingo' };
}

export function periodoRelativoIa(periodo: 'HOJE' | 'ESTE_MES' | 'ESTA_SEMANA', agora: Date) {
  const ref = referenciaTemporalIa(agora);
  const inicio = periodo === 'HOJE' ? ref.hoje : periodo === 'ESTE_MES' ? ref.inicioMes : ref.inicioSemana;
  return { inicio, fim: ref.hoje, de: inicioDiaBrasilia(inicio), ate: agora };
}
