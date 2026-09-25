import { prisma } from '../lib/prisma';
import { ErroDeNegocio } from '../lib/erros';
import { diaBrasiliaStr, inicioDiaBrasilia, fimDiaBrasilia } from '../lib/timezone';
import { FormaPagamento } from '@prisma/client';

export function formasDaProducao(pagamento = 'TODOS'): FormaPagamento[] | undefined {
  if (pagamento === 'TODOS') return undefined;
  if (pagamento === 'CARTAO') return ['CARTAO_DEBITO', 'CARTAO_CREDITO'];
  if (Object.values(FormaPagamento).includes(pagamento as FormaPagamento)) return [pagamento as FormaPagamento];
  throw new ErroDeNegocio('Selecione uma forma de pagamento válida.', 400);
}

export function validarPeriodoProducao(inicio: string, fim: string) {
  const valida = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(inicioDiaBrasilia(d).getTime()) && diaBrasiliaStr(inicioDiaBrasilia(d)) === d;
  if (!valida(inicio) || !valida(fim) || inicio > fim) throw new ErroDeNegocio('Informe um período válido.', 400);
  if (fimDiaBrasilia(fim).getTime() - inicioDiaBrasilia(inicio).getTime() > 93 * 86400000) throw new ErroDeNegocio('Selecione até 93 dias por consulta.', 400);
}

const selectProducao = {
  id: true, barbeariaId: true, barbeiroId: true, data: true, valor: true, valorComissao: true, valorLiquido: true,
  percentualComissao: true, baseComissaoAplicada: true, formaPagamento: true, agendamentoId: true,
  servico: { select: { nome: true, barbeariaId: true } },
  itens: { select: { nome: true, preco: true, barbeariaId: true }, orderBy: { ordem: 'asc' as const } },
  agendamento: { select: {
    barbeariaId: true, barbeiroId: true, status: true, dataHora: true, valorBruto: true, valorDesconto: true, servicosIds: true,
    itens: { select: { nome: true, preco: true, barbeariaId: true }, orderBy: { ordem: 'asc' as const } },
    // Conta também lançamentos fora do intervalo para não somar fechamento duplicado.
    _count: { select: { lancamentos: true } },
  } },
} as const;

type Linha = Awaited<ReturnType<typeof buscarLinhas>>[number];
function buscarLinhas(barbeariaId: string, inicio: string, fim: string, pagamento = 'TODOS', barbeiroId?: string) {
  const formas = formasDaProducao(pagamento);
  return prisma.lancamentoFinanceiro.findMany({
    where: { barbeariaId, tipo: 'ENTRADA', categoria: { not: 'Venda de Produto' }, barbeiroId: barbeiroId || { not: null },
      ...(formas ? { formaPagamento: { in: formas } } : {}), data: { gte: inicioDiaBrasilia(inicio), lte: fimDiaBrasilia(fim) } },
    select: selectProducao, orderBy: [{ data: 'desc' }, { id: 'asc' }],
  });
}
const centavos = (valor: unknown) => Math.round(Number(valor) * 100);

export function montarProducao(linhas: Linha[], barbeiros: { id: string; usuario: { nome: string } }[], barbeariaId: string) {
  return barbeiros.map(b => {
    let ignorados = 0;
    const ignoradosPorDia = new Map<string, number>();
    const registros = linhas.filter(l => l.barbeiroId === b.id && l.barbeariaId === barbeariaId).flatMap(l => {
      const a = l.agendamento;
      const itens = a?.itens.length ? a.itens : l.itens;
      const invalido = (a && (a.barbeariaId !== barbeariaId || a.barbeiroId !== b.id || a.status !== 'CONCLUIDO' || a._count.lancamentos !== 1)) ||
        (l.agendamentoId && !a) || itens.some(i => i.barbeariaId !== barbeariaId) ||
        [l.valor, l.valorComissao, l.valorLiquido].some(v => v == null || !Number.isFinite(Number(v))) ||
        Number(l.valor) < 0 || Number(l.valorComissao) < 0 || centavos(l.valor) !== centavos(l.valorComissao) + centavos(l.valorLiquido);
      if (invalido) {
        ignorados++;
        const dia = diaBrasiliaStr(l.data);
        ignoradosPorDia.set(dia, (ignoradosPorDia.get(dia) ?? 0) + 1);
        return [];
      }
      const valor = Number(l.valor), comissao = Number(l.valorComissao);
      const percentual = l.percentualComissao == null ? null : Number(l.percentualComissao);
      const base = l.baseComissaoAplicada === 'VALOR_LIQUIDO' ? valor : l.baseComissaoAplicada === 'VALOR_BRUTO' ?
        a ? Number(a.valorBruto) : itens.length ? itens.reduce((s,i)=>s+Number(i.preco),0) : null : null;
      const aviso = percentual == null || base == null ? 'Percentual ou base histórica não disponível.' :
        percentual < 0 || percentual > 100 || Math.abs(centavos(comissao) - Math.round(base * percentual)) > 1 ? 'Comissão registrada difere da base histórica. Confira o lançamento.' : null;
      const servicos = itens.length ? itens.map(i => i.nome) : a && a.servicosIds.length > 1 ? ['Vários serviços (sem detalhamento histórico)'] :
        [l.servico?.barbeariaId === barbeariaId ? l.servico.nome : 'Lançamento sem serviço detalhado'];
      return [{ id: l.id, dia: diaBrasiliaStr(l.data), dataAtendimento: a?.dataHora.toISOString() ?? null,
        origem: a ? 'ATENDIMENTO' as const : 'MANUAL' as const, servicos, produzido: valor, comissao,
        liquido: Number(l.valorLiquido), percentual, base: l.baseComissaoAplicada, desconto: a ? Number(a.valorDesconto) : null,
        formaPagamento: l.formaPagamento, aviso }];
    });
    const total = (lista: typeof registros) => ({ produzido: lista.reduce((s,r)=>s+centavos(r.produzido),0)/100,
      comissao: lista.reduce((s,r)=>s+centavos(r.comissao),0)/100, liquido: lista.reduce((s,r)=>s+centavos(r.liquido),0)/100,
      atendimentos: lista.filter(r=>r.origem==='ATENDIMENTO').length, manuais: lista.filter(r=>r.origem==='MANUAL').length });
    const dias = [...new Set(registros.map(r=>r.dia))].map(dia=>({ dia, ...total(registros.filter(r=>r.dia===dia)) }));
    const diasIgnorados = [...ignoradosPorDia].map(([dia, quantidade]) => ({ dia, quantidade }));
    return { id: b.id, nome: b.usuario.nome, ...total(registros), ignorados, diasIgnorados, dias, registros };
  });
}

export async function obterProducaoBarbeiros(barbeariaId: string, inicio: string, fim: string, filtros: { pagamento?: string; barbeiroId?: string } = {}) {
  if (!barbeariaId) throw new ErroDeNegocio('Barbearia não identificada.', 403);
  validarPeriodoProducao(inicio, fim);
  formasDaProducao(filtros.pagamento);
  if (filtros.barbeiroId !== undefined && (!filtros.barbeiroId.trim() || filtros.barbeiroId.length > 128)) throw new ErroDeNegocio('Barbeiro inválido.', 400);
  const [barbeiros, linhas] = await Promise.all([
    prisma.barbeiro.findMany({ where: { barbeariaId, ...(filtros.barbeiroId ? { id: filtros.barbeiroId } : {}) }, select: { id: true, usuario: { select: { nome: true } } }, orderBy: { usuario: { nome: 'asc' } } }),
    buscarLinhas(barbeariaId, inicio, fim, filtros.pagamento, filtros.barbeiroId),
  ]);
  if (filtros.barbeiroId && !barbeiros.length) throw new ErroDeNegocio('Barbeiro não encontrado.', 404);
  return { inicio, fim, barbeiros: montarProducao(linhas, barbeiros, barbeariaId) };
}
