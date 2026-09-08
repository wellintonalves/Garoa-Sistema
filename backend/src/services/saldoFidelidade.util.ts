import type { Prisma } from '@prisma/client';
import { ErroDeNegocio } from '../lib/erros';

export function tratarConflitoDeFechamento(error: unknown): never {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034') {
    throw new ErroDeNegocio('O atendimento ou saldo foi atualizado por outra operação. Atualize antes de tentar novamente.', 409);
  }
  throw error;
}

/** Revalida o saldo dentro da transação serializável que efetivamente fará o débito. */
export async function validarSaldoParaResgate(
  tx: Prisma.TransactionClient, clienteId: string, barbeariaId: string, pontos: number,
) {
  if (pontos <= 0) return;
  const [movimentos, resgates] = await Promise.all([
    tx.pontoFidelidade.aggregate({ where: { clienteId, barbeariaId }, _sum: { pontos: true } }),
    tx.resgateRecompensa.aggregate({
      where: { clienteId, barbeariaId, status: { in: ['PENDENTE', 'CONFIRMADO'] } },
      _sum: { pontosUsados: true },
    }),
  ]);
  const saldo = (movimentos._sum.pontos ?? 0) - (resgates._sum.pontosUsados ?? 0);
  if (saldo < pontos) throw new ErroDeNegocio('Saldo de pontos insuficiente. Atualize o atendimento.');
}
