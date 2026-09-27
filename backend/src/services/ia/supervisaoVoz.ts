import { estadoInatividade } from './politica';

/** Decisão pura para o futuro supervisor persistente. Todos os instantes vêm
 * do servidor/provedor validado, nunca de heartbeat ou relógio do navegador.
 * O executor ainda precisa confirmar fechamento e reconciliar uso faturado.
 */
export function decidirSupervisaoVoz(input: {
  agoraMs: number;
  encerrarAteMs: number;
  ultimaAtividadeMs: number;
  ocupada: boolean;
  conexaoPerdida: boolean;
}): { acao: 'continuar' | 'avisar' } | {
  acao: 'encerrar'; motivo: 'ESTADO_INVALIDO' | 'LIMITE_RESERVADO' | 'CONEXAO_PERDIDA' | 'INATIVIDADE';
} {
  const { agoraMs, encerrarAteMs, ultimaAtividadeMs } = input;
  if (![agoraMs, encerrarAteMs, ultimaAtividadeMs].every(n => Number.isSafeInteger(n) && n >= 0) || ultimaAtividadeMs > agoraMs) {
    return { acao: 'encerrar', motivo: 'ESTADO_INVALIDO' };
  }
  // Prazo da reserva inclui silêncio e execução da agente. Ocupada só impede
  // falso abandono: não pode ampliar o limite de voz ou atravessar o período.
  if (agoraMs >= encerrarAteMs) return { acao: 'encerrar', motivo: 'LIMITE_RESERVADO' };
  if (input.conexaoPerdida) return { acao: 'encerrar', motivo: 'CONEXAO_PERDIDA' };
  const inatividade = estadoInatividade((agoraMs - ultimaAtividadeMs) / 1000, input.ocupada);
  if (inatividade === 'encerrar') return { acao: 'encerrar', motivo: 'INATIVIDADE' };
  return { acao: inatividade === 'avisar' ? 'avisar' : 'continuar' };
}
