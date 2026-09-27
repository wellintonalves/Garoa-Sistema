import { ContextoIa } from './cotas';
import { RepositorioCotasPrisma } from './repositorioCotasPrisma';

export interface TransporteEncerramentoVoz {
  // Deve ser idempotente por sessão e devolver uso final verificado.
  encerrar(sessaoProvedorId: string): Promise<{
    respostaProvedorId: string; tokensEntrada: number; tokensSaida: number;
    segundosVoz: number; custoVozMicrousd: bigint;
  }>;
}

/** Executável com adaptador injetado; não agendado nem conectado à OpenAI.
 * O futuro worker recuperará o escopo de IaReserva, nunca do navegador.
 */
export async function supervisionarVoz(repo: RepositorioCotasPrisma, contexto: ContextoIa,
  reservaId: string, transporte: TransporteEncerramentoVoz, conexaoPerdida = false) {
  const ordem = await repo.reivindicarFechamentoVoz(contexto, reservaId, conexaoPerdida);
  if (ordem.acao !== 'encerrar') return ordem.acao;
  try {
    const uso = await transporte.encerrar(ordem.provedorSessaoId);
    const resultado = await repo.liquidar(contexto, reservaId, { ...uso, mensagens: 0 });
    return resultado.estado === 'CONCLUIDA' ? 'encerrada' : 'incerta';
  } catch {
    await repo.falhaFechamentoVoz(contexto, reservaId, ordem.leaseVersao);
    return 'incerta';
  }
}
