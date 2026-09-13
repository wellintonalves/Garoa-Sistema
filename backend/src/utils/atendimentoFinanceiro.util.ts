import { CATEGORIA_VENDA_PRODUTO } from '../lib/constantes';

interface LancamentoParaContagem {
  tipo: string;
  categoria: string;
  servicoId?: string | null;
  barbeiroId?: string | null;
  agendamentoId?: string | null;
}

/** Um lançamento representa um atendimento, inclusive manual ou combo. */
export function ehAtendimentoFinanceiro(lancamento: LancamentoParaContagem): boolean {
  if (lancamento.tipo !== 'ENTRADA' || lancamento.categoria === CATEGORIA_VENDA_PRODUTO) return false;
  const categoria = lancamento.categoria.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const categoriaServico = ['servico', 'servicos', 'servico prestado', 'servicos prestados'].includes(categoria);
  return Boolean(lancamento.servicoId || lancamento.barbeiroId || lancamento.agendamentoId || categoriaServico);
}
