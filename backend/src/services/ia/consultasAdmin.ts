import { Prisma, PrismaClient } from '@prisma/client';
import { ContextoIa } from './cotas';
import { ErroDeNegocio } from '../../lib/erros';
import { inicioDiaBrasilia, fimDiaBrasilia, diaBrasiliaStr } from '../../lib/timezone';
import { ehAtendimentoFinanceiro } from '../../utils/atendimentoFinanceiro.util';
import { CATEGORIA_ESTORNO_PRODUTO } from '../../lib/constantes';
import { montarProducao, selectProducao } from '../producaoBarbeiro.service';
import { periodoRelativoIa, referenciaTemporalIa } from './tempo';

const tipos = ['PRODUCAO', 'RANKING_PRODUCAO', 'RECEBIMENTOS', 'PRODUTOS', 'PRECOS'] as const;
const pagamentos = ['TODOS', 'DINHEIRO', 'PIX', 'CARTAO', 'CARTAO_CREDITO', 'CARTAO_DEBITO'] as const;
type Filtros = { consulta: typeof tipos[number]; inicio: string; fim: string; barbeiro: string | null;
  produto: string | null; pagamento: typeof pagamentos[number]; criterio: 'QUANTIDADE' | 'RECEITA'; periodoRelativo?: 'HOJE' | 'ESTE_MES' | 'ESTA_SEMANA' | null };
export const ferramentaAdmin = {
  type: 'function', name: 'consultar_dados_administrativos', strict: true,
  description: 'Consulta agregados reais da barbearia. RANKING_PRODUCAO responde quem mais produziu: todos os barbeiros, sem pedir nome, padrão criterio=RECEITA. Reutiliza o relatório de produção de serviços após descontos, antes da comissão, por data financeira, incluindo manuais consistentes. QUANTIDADE compara atendimentos/manuais. PRODUCAO detalha totais de agendamentos e financeiro separados. RECEBIMENTOS consulta caixa; PRODUTOS consulta ranking/margem bruta; PRECOS consulta preços praticados. Datas relativas são calculadas pelo servidor, máximo 366 dias.',
  parameters: { type: 'object', additionalProperties: false,
    properties: { consulta: { type: 'string', enum: tipos }, inicio: { type: ['string', 'null'], description: 'YYYY-MM-DD inclusivo; null quando usar periodoRelativo' },
      fim: { type: ['string', 'null'], description: 'YYYY-MM-DD inclusivo; null quando usar periodoRelativo' }, barbeiro: { type: ['string', 'null'], description: 'Nome exato ou null para todos. No ranking sempre null.' },
      produto: { type: ['string', 'null'], description: 'Nome exato do produto ou null para todos' }, pagamento: { type: 'string', enum: pagamentos },
      criterio: { type: 'string', enum: ['QUANTIDADE', 'RECEITA'], description: 'Ranking de produção: RECEITA por padrão; QUANTIDADE só quando a pessoa pedir quantidade.' },
      periodoRelativo: { type: ['string', 'null'], enum: ['HOJE', 'ESTE_MES', 'ESTA_SEMANA', null], description: 'Este mês = dia 1 até agora. Esta semana = domingo até agora. Use null para datas explícitas.' } },
    required: ['consulta', 'inicio', 'fim', 'barbeiro', 'produto', 'pagamento', 'criterio', 'periodoRelativo'] },
};

function validar(valor: unknown, agora: Date): Filtros {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new ErroDeNegocio('Filtros inválidos.');
  const f = { ...valor } as Filtros;
  const campos = ferramentaAdmin.parameters.required;
  if (campos.filter(k => k !== 'periodoRelativo').some(k => !(k in f)) || Object.keys(f).some(k => !campos.includes(k)) ||
    !tipos.includes(f.consulta) || !pagamentos.includes(f.pagamento) || !['QUANTIDADE', 'RECEITA'].includes(f.criterio)) throw new ErroDeNegocio('Filtros inválidos.');
  if (f.periodoRelativo !== undefined && f.periodoRelativo !== null) {
    if (!['HOJE', 'ESTE_MES', 'ESTA_SEMANA'].includes(f.periodoRelativo) || f.inicio !== null || f.fim !== null) throw new ErroDeNegocio('Use período relativo com início e fim nulos.');
    const periodo = periodoRelativoIa(f.periodoRelativo, agora); f.inicio = periodo.inicio; f.fim = periodo.fim;
  }
  for (const d of [f.inicio, f.fim]) {
    if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d) || d < '2000-01-01' || d > '2100-12-31' ||
      !Number.isFinite(inicioDiaBrasilia(d).getTime()) || diaBrasiliaStr(inicioDiaBrasilia(d)) !== d) throw new ErroDeNegocio('Informe datas válidas no formato YYYY-MM-DD.');
  }
  const dias = (inicioDiaBrasilia(f.fim).getTime() - inicioDiaBrasilia(f.inicio).getTime()) / 86400000;
  if (dias < 0 || dias > 365) throw new ErroDeNegocio('Escolha um período de até 366 dias, com início anterior ao fim.');
  for (const n of [f.barbeiro, f.produto]) if (n !== null && (typeof n !== 'string' || !n.trim() || n.length > 100)) throw new ErroDeNegocio('Nome de filtro inválido.');
  if ((f.consulta === 'PRODUCAO' && (f.produto || f.pagamento !== 'TODOS')) ||
    (f.consulta === 'RANKING_PRODUCAO' && (f.barbeiro || f.produto || f.pagamento !== 'TODOS')) ||
    (f.consulta === 'RECEBIMENTOS' && f.produto) || (['PRODUTOS', 'PRECOS'].includes(f.consulta) && f.barbeiro) ||
    (f.consulta === 'PRECOS' && !f.produto)) throw new ErroDeNegocio('Filtros incompatíveis. Produção não filtra meio de pagamento; preços exigem um produto.');
  return f;
}
const cents = (v: Prisma.Decimal | null) => v === null ? 0 : v.mul(100).toDecimalPlaces(0).toNumber();
function limitar<T>(rows: T[]) { if (rows.length > 5000) throw new ErroDeNegocio('Há mais de 5.000 registros. Reduza o período; nenhum total parcial foi calculado.'); return rows; }
const reais = (v: number) => {
  if (!Number.isSafeInteger(v)) throw new ErroDeNegocio('Total excede o limite de precisão. Reduza o período.');
  return new Prisma.Decimal(v).div(100).toFixed(2);
};

/** Sem SQL livre, sem dados individuais de clientes e sem depender apenas de RLS/ALS. */
export async function consultarAdmin(db: PrismaClient, c: ContextoIa, argumentos: unknown, signal?: AbortSignal, agora = new Date(Date.now())) {
  signal?.throwIfAborted();
  if (c.papel !== 'ADMIN' || !c.barbeariaId || !c.usuarioId) throw new ErroDeNegocio('Consulta exclusiva de administradores.', 403);
  const f = validar(argumentos, agora);
  return db.$transaction(async tx => {
    const autorizado = await tx.usuario.findFirst({ where: { id: c.usuarioId, barbeariaId: c.barbeariaId, papel: 'ADMIN', barbearia: { ativo: true } }, select: { id: true } });
    if (!autorizado) throw new ErroDeNegocio('Consulta não autorizada.', 403);
    let barbeiroId: string | undefined;
    if (f.barbeiro) {
      const encontrados = await tx.barbeiro.findMany({ where: { barbeariaId: c.barbeariaId, usuario: { nome: { equals: f.barbeiro.trim(), mode: 'insensitive' } } }, select: { id: true }, take: 2 });
      if (encontrados.length !== 1) throw new ErroDeNegocio(encontrados.length ? 'Há barbeiros com o mesmo nome. Use o relatório para selecionar a pessoa.' : 'Barbeiro não encontrado nesta barbearia. Confirme o nome completo.');
      barbeiroId = encontrados[0].id;
    }
    const data = { gte: inicioDiaBrasilia(f.inicio), lte: new Date(Math.min(fimDiaBrasilia(f.fim).getTime(), agora.getTime())) };
    const formaPagamento = f.pagamento === 'TODOS' ? undefined : f.pagamento === 'CARTAO'
      ? { in: ['CARTAO_CREDITO', 'CARTAO_DEBITO'] as ('CARTAO_CREDITO' | 'CARTAO_DEBITO')[] } : f.pagamento;
    const base = { filtros: f, fuso: 'America/Sao_Paulo', moeda: 'BRL', valores: 'Reais decimais calculados no servidor', consultadoEm: agora.toISOString(),
      intervalo: { inicioInclusivo: data.gte.toISOString(), fimInclusivo: data.lte.toISOString() }, referenciaTemporal: referenciaTemporalIa(agora) };
    if (f.consulta === 'RANKING_PRODUCAO') {
      const barbeiros = await tx.barbeiro.findMany({ where: { barbeariaId: c.barbeariaId, usuario: { barbeariaId: c.barbeariaId } }, select: { id: true, usuario: { select: { nome: true } } }, take: 501 });
      if (barbeiros.length > 500) throw new ErroDeNegocio('O ranking ultrapassa o limite de 500 barbeiros.');
      const linhas = limitar(await tx.lancamentoFinanceiro.findMany({ where: { barbeariaId: c.barbeariaId, tipo: 'ENTRADA', categoria: { not: 'Venda de Produto' }, barbeiroId: { not: null }, data }, select: selectProducao, take: 5001 }));
      signal?.throwIfAborted();
      const producao = montarProducao(linhas, barbeiros, c.barbeariaId);
      const comparados = producao.map(p => ({ nome: p.nome.slice(0, 100), produzido: Math.round(p.produzido * 100), quantidade: p.atendimentos + p.manuais, manuais: p.manuais }));
      const valor = (p: typeof comparados[number]) => f.criterio === 'QUANTIDADE' ? p.quantidade : p.produzido;
      const ordenados = comparados.sort((a, b) => valor(b) - valor(a) || a.nome.localeCompare(b.nome));
      const temDados = ordenados.some(p => p.quantidade > 0);
      const lideres = temDados ? ordenados.filter(p => valor(p) === valor(ordenados[0])) : [];
      const serializar = (p: typeof comparados[number]) => ({ nome: p.nome, valorProduzido: reais(p.produzido), quantidade: p.quantidade, lancamentosManuais: p.manuais });
      const dias = producao.flatMap(p => p.dias.map(d => d.dia)).sort();
      return { ...base, fonte: 'Relatório de produção por barbeiro', criterio: f.criterio,
        metrica: f.criterio === 'QUANTIDADE' ? 'Quantidade de atendimentos concluídos e lançamentos manuais consistentes' : 'Valor de serviços lançados após descontos e antes de comissão, pela data financeira',
        estado: temDados ? lideres.length > 1 ? 'EMPATE' : 'LIDER' : 'SEM_DADOS', barbeirosComparados: barbeiros.length,
        lideres: lideres.map(serializar), ranking: ordenados.slice(0, 10).map(serializar), primeiraProducaoRegistrada: dias[0] ?? null,
        registrosIgnorados: producao.reduce((s, p) => s + p.ignorados, 0),
        limites: ['Mesmas regras do relatório: exclui produtos, cancelados, fechamentos duplicados e lançamentos inconsistentes. Inclui manuais válidos e barbeiros inativos com histórico.', 'Não é recebimento bancário nem comissão. Não soma valores de agenda aos lançamentos.', 'A janela da semana começa domingo; dias sem produção permanecem sem registros. Ausência de registro não comprova fechamento da barbearia.'] };
    }
    if (f.consulta === 'PRODUCAO' || f.consulta === 'RECEBIMENTOS') {
      const rows = limitar(await tx.lancamentoFinanceiro.findMany({ where: { barbeariaId: c.barbeariaId, data, ...(barbeiroId ? { barbeiroId } : {}), ...(formaPagamento ? { formaPagamento } : {}) },
        select: { tipo: true, categoria: true, valor: true, formaPagamento: true, barbeiroId: true, servicoId: true, agendamentoId: true, valorComissao: true } , take: 5001 }));
      signal?.throwIfAborted();
      if (f.consulta === 'RECEBIMENTOS') {
        const porMeio = new Map<string, { entradas: number; saidas: number; estornosProdutos: number }>();
        for (const l of rows) { const v = porMeio.get(l.formaPagamento) ?? { entradas: 0, saidas: 0, estornosProdutos: 0 };
          if (l.tipo === 'ENTRADA') v.entradas += cents(l.valor); else { v.saidas += cents(l.valor); if (l.categoria === CATEGORIA_ESTORNO_PRODUTO) v.estornosProdutos += cents(l.valor); }
          porMeio.set(l.formaPagamento, v); }
        return { ...base, fonte: 'Lançamentos financeiros pela data financeira, como no relatório de caixa', registros: rows.length,
          totalEntradasRegistradas: reais([...porMeio.values()].reduce((s, v) => s + v.entradas, 0)),
          totalSaidasRegistradas: reais([...porMeio.values()].reduce((s, v) => s + v.saidas, 0)),
          saldoMovimentado: reais([...porMeio.values()].reduce((s, v) => s + v.entradas - v.saidas, 0)),
          porMeio: [...porMeio].map(([meio, v]) => ({ meio, entradasRegistradas: reais(v.entradas), saidasRegistradas: reais(v.saidas), estornosProdutos: reais(v.estornosProdutos), saldoMovimentado: reais(v.entradas - v.saidas) })),
          limites: ['Entradas registradas são recebimentos informados no sistema, sem conciliação bancária. Não são produção nem lucro.', 'Cada lançamento tem um único meio. Não há parcelas estruturadas de pagamento dividido; não é possível reconstituí-las.', 'Estornos de produtos entram como saída na data do estorno. Outras devoluções só constam se registradas como saída. Saídas não são todas estornos.'] };
      }
      const ags = limitar(await tx.agendamento.findMany({ where: { barbeariaId: c.barbeariaId, status: 'CONCLUIDO', dataHora: data, ...(barbeiroId ? { barbeiroId } : {}) }, select: { valorCobrado: true }, take: 5001 }));
      const servicos = rows.filter(ehAtendimentoFinanceiro);
      return { ...base, fonte: 'Agendamentos concluídos (data do atendimento) e lançamentos de serviços (data financeira)',
        agendamentosConcluidos: ags.length, valorCobradoAgendamentosConcluidos: reais(ags.reduce((s, a) => s + cents(a.valorCobrado), 0)),
        lancamentosDeServicos: servicos.length, entradasServicosAposDescontos: reais(servicos.reduce((s, l) => s + cents(l.valor), 0)),
        comissoesRegistradas: reais(servicos.reduce((s, l) => s + cents(l.valorComissao), 0)), comissoesSemRegistro: servicos.filter(l => l.valorComissao === null).length,
        limites: ['Agendamentos cancelados ou não concluídos não contam na produção. Atendimentos manuais aparecem apenas nos lançamentos.', 'Não some o valor dos agendamentos às entradas: podem representar o mesmo atendimento em datas diferentes.', 'Comissão histórica registrada, sem recalcular percentual atual. Valores ausentes são desconhecidos, não comissão zero.', 'Entradas de serviços são valores após descontos, antes de comissão. Não representam lucro líquido.'] };
    }
    const rows = limitar(await tx.vendaProduto.findMany({ where: { barbeariaId: c.barbeariaId, data,
      ...(formaPagamento ? { formaPagamento } : {}), ...(f.produto ? { nomeProduto: { equals: f.produto.trim(), mode: 'insensitive' } } : {}),
      OR: [{ vendaId: null }, { venda: { barbeariaId: c.barbeariaId, estornadaEm: null } }] },
      select: { estoqueId: true, nomeProduto: true, quantidade: true, precoVenda: true, custoUnitario: true, descontoRateado: true, data: true, vendaId: true }, take: 5001 }));
    signal?.throwIfAborted();
    const grupos = new Map<string, { nome: string; unidades: number; receita: number; custo: number }>();
    for (const v of rows) { const key = v.estoqueId ?? `historico:${v.nomeProduto}`; const g = grupos.get(key) ?? { nome: v.nomeProduto.slice(0, 100), unidades: 0, receita: 0, custo: 0 };
      const bruto = cents(v.precoVenda) * v.quantidade; const custo = cents(v.custoUnitario) * v.quantidade;
      reais(bruto); reais(custo);
      g.unidades += v.quantidade; g.receita += bruto - cents(v.descontoRateado); g.custo += custo; reais(g.receita); reais(g.custo); grupos.set(key, g); }
    const limites = ['Vendas atualmente estornadas são excluídas, mesmo se o estorno ocorreu após o período. Este é o critério do histórico de estoque, diferente do fluxo de caixa.', 'Margem bruta de produtos: receita após desconto rateado menos custo unitário histórico. Não inclui despesas, taxas nem tributos; não é lucro líquido.', 'Não existe histórico de alterações do preço de tabela. O preço unitário registrado na venda pode refletir negociação; desconto rateado é separado.', 'Itens sem vínculo de estoque são agrupados pelo nome histórico; homônimos não podem ser distinguidos.'];
    if (f.consulta === 'PRECOS') {
      if (grupos.size > 1) throw new ErroDeNegocio('Mais de um produto tem esse nome. Não é possível comparar preços como se fossem um só produto.');
      const meses = new Map<string, { unidades: number; minimo: number; maximo: number; receita: number }>();
      for (const v of rows) { const mes = diaBrasiliaStr(v.data).slice(0, 7); const preco = cents(v.precoVenda); const g = meses.get(mes) ?? { unidades: 0, minimo: preco, maximo: preco, receita: 0 };
        g.unidades += v.quantidade; g.minimo = Math.min(g.minimo, preco); g.maximo = Math.max(g.maximo, preco); g.receita += preco * v.quantidade - cents(v.descontoRateado); meses.set(mes, g); }
      return { ...base, fonte: 'Valores registrados em vendas de produtos', registros: rows.length, historicoTabelaDisponivel: false,
        meses: [...meses].sort(([a], [b]) => a.localeCompare(b)).map(([mes, v]) => ({ mes, unidades: v.unidades, menorPrecoUnitarioRegistrado: reais(v.minimo), maiorPrecoUnitarioRegistrado: reais(v.maximo), precoMedioLiquidoPraticado: v.unidades ? new Prisma.Decimal(v.receita).div(100).div(v.unidades).toFixed(2) : null })), limites };
    }
    const receita = [...grupos.values()].reduce((s, g) => s + g.receita, 0); const custo = [...grupos.values()].reduce((s, g) => s + g.custo, 0);
    const ranking = [...grupos.values()].sort((a, b) => (f.criterio === 'QUANTIDADE' ? b.unidades - a.unidades : b.receita - a.receita) || a.nome.localeCompare(b.nome));
    return { ...base, fonte: 'Histórico de vendas e snapshots de custo/desconto', registros: rows.length, registrosLegadosSemVenda: rows.filter(v => !v.vendaId).length,
      receitaLiquidaProdutos: reais(receita), custoHistoricoProdutos: reais(custo), lucroBrutoProdutos: reais(receita - custo),
      margemBrutaPercentual: receita > 0 ? new Prisma.Decimal(receita - custo).mul(100).div(receita).toFixed(2) : null,
      totalProdutos: grupos.size, ranking: ranking.slice(0, 10).map(g => ({ nome: g.nome, unidades: g.unidades, receitaLiquida: reais(g.receita), lucroBruto: reais(g.receita - g.custo) })), limites };
  }, { isolationLevel: 'RepeatableRead', timeout: 10000 });
}
