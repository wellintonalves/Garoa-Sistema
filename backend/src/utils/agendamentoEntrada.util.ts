import { FormaPagamento, StatusAgendamento } from '@prisma/client';
import { objetoPermitido, texto, numero, listaIds, opcao } from './entradaSegura.util';
import type { TipoDesconto } from '../services/desconto.service';

export interface AlteracaoAgendamento {
  barbeiroId?: string;
  servicoId?: string;
  servicosIds?: string[];
  dataHora?: string;
  observacoes?: string | null;
  status?: StatusAgendamento;
  formaPagamento?: FormaPagamento;
  tipoDesconto?: TipoDesconto;
  pontosUsados?: number;
  descontoPercentual?: number;
  descontoReais?: number;
}

export function validarAlteracaoAgendamento(entrada: unknown): AlteracaoAgendamento {
  const dados = objetoPermitido(entrada, ['barbeiroId', 'servicoId', 'servicosIds', 'dataHora', 'observacoes', 'status', 'formaPagamento', 'tipoDesconto', 'pontosUsados', 'descontoPercentual', 'descontoReais']);
  // Construct only validated scalar values. No caller-owned object reaches Prisma.
  const result: AlteracaoAgendamento = {};
  if (dados.barbeiroId !== undefined) result.barbeiroId = texto(dados.barbeiroId);
  if (dados.servicoId !== undefined) result.servicoId = texto(dados.servicoId);
  if (dados.servicosIds !== undefined) result.servicosIds = listaIds(dados.servicosIds);
  if (dados.dataHora !== undefined) result.dataHora = texto(dados.dataHora, 40);
  if (dados.observacoes !== undefined) result.observacoes = dados.observacoes === null ? null : texto(dados.observacoes, 4000, true);
  if (dados.status !== undefined) result.status = opcao(dados.status, Object.values(StatusAgendamento));
  if (dados.formaPagamento !== undefined) result.formaPagamento = opcao(dados.formaPagamento, Object.values(FormaPagamento));
  if (dados.tipoDesconto !== undefined) result.tipoDesconto = opcao(dados.tipoDesconto, ['NENHUM', 'REAIS', 'PERCENTUAL', 'PONTOS', 'COMBINADO'] as const);
  if (dados.pontosUsados !== undefined) result.pontosUsados = numero(dados.pontosUsados, Number.MAX_SAFE_INTEGER, true);
  if (dados.descontoPercentual !== undefined) result.descontoPercentual = numero(dados.descontoPercentual, 100);
  if (dados.descontoReais !== undefined) result.descontoReais = numero(dados.descontoReais, 99999999.99);
  return result;
}

export interface ReciboAgendamento {
  id: string;
  dataHora: Date;
  status: StatusAgendamento;
  servico: { nome: string; duracaoMinutos: number };
  barbeiro: { usuario: { nome: string } };
}

/** Customer-facing booking receipts never contain global profile or staff account fields. */
export function reciboAgendamento(agendamento: ReciboAgendamento) {
  return {
    id: agendamento.id,
    dataHora: agendamento.dataHora,
    status: agendamento.status,
    servico: { nome: agendamento.servico.nome, duracaoMinutos: agendamento.servico.duracaoMinutos },
    barbeiro: { nome: agendamento.barbeiro.usuario.nome },
  };
}
