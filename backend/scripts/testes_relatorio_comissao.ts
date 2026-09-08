import assert from 'node:assert/strict';
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
(globalThis as typeof globalThis & { prisma?: unknown }).prisma = {
  $extends: () => ({ lancamentoFinanceiro: { findMany: async () => linhas } }),
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
  console.log('PASS comissão e relatório: arredondamento, percentual zero, líquido zero, divergência, ausência de histórico, percentuais mistos e base bruta.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
