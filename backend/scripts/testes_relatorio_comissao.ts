import assert from 'node:assert/strict';
import { tenantStorage } from '../src/lib/als';
import { calcularComissao } from '../src/utils/comissao.util';

assert.equal(calcularComissao(35, 45), 15.75);
assert.equal(calcularComissao(40, 45), 18);
assert.equal(calcularComissao(33.33, 45), 15);
assert.equal(calcularComissao(100, 0), 0);
assert.throws(() => calcularComissao(100, 101), /inválido/);

// Testa o relatório real com resultados de persistência controlados, sem banco.
const comum = { tipo: 'ENTRADA', categoria: 'Serviço', barbeiroId: 'b', barbeiro: { usuario: { nome: 'Teste' } },
  valor: 40, valorComissao: 18, valorLiquido: 22, percentualComissao: 45, baseComissaoAplicada: 'VALOR_LIQUIDO', itens: [] };
let linhas: Record<string, unknown>[] = [];
let ultimaConsulta: any;
(globalThis as typeof globalThis & { prisma?: unknown }).prisma = {
  $extends: () => ({ lancamentoFinanceiro: { findMany: async (consulta: any) => { ultimaConsulta = consulta; assert.equal(consulta.where.barbeariaId, tenantStorage.getStore()?.barbeariaId); return linhas; } } }),
};
async function main() {
  const { FinanceiroService } = await import('../src/services/financeiro.service');
  const relatorio = () => FinanceiroService.relatorio({ inicio: '2026-09-01', fim: '2026-09-08' });
  linhas = [comum, { ...comum, valor: 35, valorComissao: 35, valorLiquido: 0 }];
  let resultado = await relatorio();
  assert.equal(resultado.consolidado.totalLiquido, 22, 'líquido zero não vira valor bruto');
  assert.equal(resultado.consolidado.porBarbeiro.b.percentualAplicado, 45);
  assert.equal(resultado.consolidado.porBarbeiro.b.lancamentosDivergentes, 1);
  linhas = [comum, { ...comum, percentualComissao: null }];
  resultado = await relatorio();
  assert.equal(resultado.consolidado.porBarbeiro.b.percentualAplicado, null);
  assert.equal(resultado.consolidado.porBarbeiro.b.lancamentosSemBaseAuditavel, 1);
  assert.equal(resultado.consolidado.porBarbeiro.b.lancamentosDivergentes, 0);
  linhas = [{ ...comum, valor: 30, valorComissao: 18, valorLiquido: 12, baseComissaoAplicada: 'VALOR_BRUTO', itens: [{ preco: 40 }] }];
  resultado = await relatorio();
  assert.equal(resultado.consolidado.porBarbeiro.b.lancamentosDivergentes, 0, 'comissão bruta não é comparada ao líquido');
  linhas = [comum, { ...comum, percentualComissao: 50, valorComissao: 20 }];
  resultado = await relatorio();
  assert.equal(resultado.consolidado.porBarbeiro.b.percentualAplicado, null);
  linhas = [{ ...comum, valorComissao: 18.01 }];
  assert.equal((await relatorio()).consolidado.porBarbeiro.b.lancamentosDivergentes, 0);
  linhas = [comum, { tipo: 'ENTRADA', categoria: 'Venda de Produto', valor: 90 },
    { tipo: 'SAIDA', categoria: 'Estorno de Produto', valor: 90 }];
  assert.equal((await relatorio()).consolidado.totalProdutos, 0);
  assert.equal((await relatorio()).consolidado.totalComissoes, 18);
  linhas = [
    { ...comum, id: 'servico-pix', formaPagamento: 'PIX' },
    { ...comum, id: 'servico-debito', formaPagamento: 'CARTAO_DEBITO', valor: 60, valorComissao: 27, valorLiquido: 33 },
    { id: 'produto-pix', tipo: 'ENTRADA', categoria: 'Venda de Produto', valor: 90, formaPagamento: 'PIX' },
    { id: 'produto-credito', tipo: 'ENTRADA', categoria: 'Venda de Produto', valor: 50, formaPagamento: 'CARTAO_CREDITO' },
    { id: 'estorno-pix', tipo: 'SAIDA', categoria: 'Estorno de Produto', valor: 20, formaPagamento: 'PIX' },
    { id: 'produto-dinheiro', tipo: 'ENTRADA', categoria: 'Venda de Produto', valor: 30, formaPagamento: 'DINHEIRO' },
  ];
  const filtrar = (natureza: 'todos' | 'produtos' | 'servicos', pagamento = 'todos') =>
    FinanceiroService.relatorio({ inicio: '2026-09-01', fim: '2026-09-08', natureza, pagamento: pagamento as 'todos' | 'PIX' });
  resultado = await filtrar('todos');
  assert.deepEqual(resultado.lancamentos.map(l => l.id), linhas.map(l => l.id));
  assert.equal(resultado.consolidado.totalBruto, 100);
  assert.equal(resultado.consolidado.totalProdutos, 150);
  assert.equal(resultado.consolidado.totalComissoes, 45);
  assert.equal(resultado.consolidado.totalLiquido, 205);
  assert.deepEqual(await relatorio(), resultado, 'sem parâmetro mantém Todos');
  resultado = await filtrar('produtos');
  assert.equal(resultado.consolidado.totalBruto, 0);
  assert.equal(resultado.consolidado.totalProdutos, 150);
  assert.equal(resultado.consolidado.totalLiquido, 150);
  assert.equal(resultado.consolidado.totalComissoes, 0);
  assert.deepEqual(resultado.consolidado.porBarbeiro, {});
  resultado = await filtrar('servicos');
  assert.equal(resultado.consolidado.totalProdutos, 0);
  assert.equal(resultado.consolidado.totalLiquido, 55);
  assert.equal(resultado.consolidado.porBarbeiro.b.bruto, 100);
  for (const [pagamento, ids, liquido] of [
    ['PIX', ['produto-pix', 'estorno-pix'], 70],
    ['CARTAO', ['produto-credito'], 50],
    ['CARTAO_CREDITO', ['produto-credito'], 50],
    ['CARTAO_DEBITO', [], 0],
    ['DINHEIRO', ['produto-dinheiro'], 30],
  ] as const) {
    resultado = await filtrar('produtos', pagamento);
    assert.deepEqual(resultado.lancamentos.map(l => l.id), ids);
    assert.equal(resultado.consolidado.totalLiquido, liquido);
  }
  resultado = await filtrar('todos', 'CARTAO');
  assert.equal(resultado.consolidado.totalLiquido, 83);
  assert.equal(resultado.consolidado.totalComissoes, 27);
  resultado = await filtrar('servicos', 'PIX');
  assert.deepEqual(resultado.lancamentos.map(l => l.id), ['servico-pix']);
  assert.equal(resultado.consolidado.totalLiquido, 22);
  assert.equal(resultado.consolidado.porBarbeiro.b.comissao, 18);
  const itensProduto = [
    { estoqueId: 'pomada', nomeProduto: 'Pomada', quantidade: 2, precoVenda: 30, descontoRateado: 10 },
    { estoqueId: 'shampoo', nomeProduto: 'Shampoo', quantidade: 1, precoVenda: 40, descontoRateado: 0 },
  ];
  linhas = [
    { id: 'carrinho', tipo: 'ENTRADA', categoria: 'Venda de Produto', valor: 90, formaPagamento: 'PIX', vendaEstoque: { itens: itensProduto } },
    { id: 'estorno', tipo: 'SAIDA', categoria: 'Estorno de Produto', valor: 90, formaPagamento: 'PIX', estornoVendaEstoque: { itens: itensProduto } },
    { id: 'antigo', tipo: 'ENTRADA', categoria: 'Venda de Produto', valor: 10, formaPagamento: 'PIX' },
    { id: 'historico', tipo: 'ENTRADA', categoria: 'Venda de Produto', valor: 25, formaPagamento: 'DINHEIRO', vendaEstoque: { itens: [{ estoqueId: null, nomeProduto: 'Produto antigo', quantidade: 1, precoVenda: 25 }] } },
  ];
  const produto = (produtoId: string) => FinanceiroService.relatorio({ inicio: '2026-09-01', fim: '2026-09-08', natureza: 'produtos', produtoId });
  resultado = await produto('estoque:pomada');
  assert.deepEqual(resultado.lancamentos.map(l => Number(l.valor)), [50, 50], 'somente a parcela líquida do produto, inclusive no estorno');
  assert.equal(resultado.consolidado.totalProdutos, 0);
  assert.equal(resultado.produtosSemDetalhamento, 1, 'lançamento antigo não é atribuído por aproximação');
  assert.equal((await produto('historico:Produto antigo')).consolidado.totalProdutos, 25);
  assert.equal((await produto('estoque:inexistente')).lancamentos.length, 0);
  assert.equal((await FinanceiroService.relatorio({ inicio: '2026-09-01', fim: '2026-09-08', natureza: 'todos', produtoId: 'estoque:pomada' })).consolidado.totalProdutos, 35, 'produto oculto não restringe Todos');
  linhas = [{ ...linhas[0], valor: 80 }];
  assert.equal((await produto('estoque:pomada')).lancamentos.length, 0, 'desconto sem rateio compatível não é inventado');
  linhas = [];
  assert.equal((await filtrar('produtos', 'PIX')).consolidado.totalLiquido, 0);
  await FinanceiroService.relatorio({});
  assert.equal(ultimaConsulta.where.barbeariaId, 'tenant-relatorio');
  await tenantStorage.run({ barbeariaId: 'outra-barbearia' }, async () => {
    await FinanceiroService.relatorio({});
    assert.equal(ultimaConsulta.where.barbeariaId, 'outra-barbearia');
  });
  await tenantStorage.exit(async () => {
    await assert.rejects(() => FinanceiroService.relatorio({}), /Barbearia não identificada/);
    await assert.rejects(() => FinanceiroService.produtosRelatorio(), /Barbearia não identificada/);
  });
  assert.equal(ultimaConsulta.where.data, undefined, 'limpar remove a restrição de período');
  assert.equal(ultimaConsulta.where.barbeiroId, undefined);
  const { FinanceiroController } = await import('../src/controllers/financeiro.controller');
  for (const query of [{ natureza: 'invalido' }, { pagamento: 'BOLETO' }, { pagamento: ['PIX'] }, { produtoId: ['estoque:pomada'] }, { barbeiroId: ['outro'] }]) {
    let status = 200;
    const res = { status: (code: number) => { status = code; return res; }, json: () => res };
    await FinanceiroController.relatorio({ query: { inicio: '2026-09-01', fim: '2026-09-08', ...query } } as any, res as any);
    assert.equal(status, 400);
  }
  for (const query of [{ inicio: '2026-09-01' }, { inicio: '2026-09-26', fim: '2026-09-01' }, { inicio: '2026-02-30', fim: '2026-03-01' }]) {
    let status = 200;
    const res = { status: (code: number) => { status = code; return res; }, json: () => res };
    await FinanceiroController.relatorio({ query } as any, res as any);
    assert.equal(status, 400);
  }
  let statusSemPeriodo = 200;
  const resSemPeriodo = { status: (code: number) => { statusSemPeriodo = code; return resSemPeriodo; }, json: () => resSemPeriodo };
  await FinanceiroController.relatorio({ query: {} } as any, resSemPeriodo as any);
  assert.equal(statusSemPeriodo, 200);
  console.log('PASS filtros de relatório: tipos, meios de pagamento, combinações, estorno, totais, vazio e parâmetros inválidos.');
  console.log('PASS comissão e relatório: arredondamento, percentual zero, líquido zero, divergência, ausência de histórico, percentuais mistos e base bruta.');
}
tenantStorage.run({ barbeariaId: 'tenant-relatorio' }, main).catch(error => { console.error(error); process.exitCode = 1; });
