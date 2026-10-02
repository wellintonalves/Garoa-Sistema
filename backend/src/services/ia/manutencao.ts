import { registrarErroSeguro } from '../../lib/logSeguro';
import { PrismaClient } from '@prisma/client';

/** Retira somente o conteúdo cifrado expirado. Ledger e reservas são preservados.
 * Seguro com múltiplos processos: UPDATE condicional idempotente no banco.
 */
export async function limparResultadosIa(db: PrismaClient) {
  const [clock] = await db.$queryRaw<{ agora: Date }[]>`SELECT clock_timestamp() AS agora`;
  return db.iaReserva.updateMany({ where: { resultadoExpiraEm: { lte: clock.agora }, respostaCifrada: { not: null } }, data: { respostaCifrada: null } });
}

export function agendarLimpezaResultadosIa(db: PrismaClient) {
  if (process.env.IA_PERSISTENCIA_ENABLED !== 'true') return;
  const executar = () => void limparResultadosIa(db).catch(() => registrarErroSeguro('services.ia.manutencao.falha', undefined));
  executar();
  const timer = setInterval(executar, 60_000);
  timer.unref();
}
