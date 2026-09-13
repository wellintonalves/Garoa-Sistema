import assert from 'node:assert/strict';
import { ehAtendimentoFinanceiro } from '../src/utils/atendimentoFinanceiro.util';
import { tenantStorage } from '../src/lib/als';

const base = { tipo: 'ENTRADA', categoria: 'Serviço Prestado', servicoId: null, barbeiroId: null, agendamentoId: null };
assert.equal(ehAtendimentoFinanceiro(base), true);
assert.equal(ehAtendimentoFinanceiro({ ...base, categoria: ' Serviço ' }), true);
assert.equal(ehAtendimentoFinanceiro({ ...base, categoria: 'Corte avulso', barbeiroId: 'b' }), true);
assert.equal(ehAtendimentoFinanceiro({ ...base, categoria: 'Aporte' }), false);
assert.equal(ehAtendimentoFinanceiro({ ...base, categoria: 'Venda de Produto', servicoId: 's', barbeiroId: 'b' }), false);
assert.equal(ehAtendimentoFinanceiro({ ...base, tipo: 'SAIDA' }), false);

type Where = { barbeariaId?: string; data?: { gte: Date; lte: Date } };
type Extension = { query: { $allModels: { $allOperations(input: {
  model: string; operation: string; args: { where?: Where }; query: (args: { where?: Where }) => Promise<unknown>;
}): Promise<unknown> } } };
const dia = new Date('2026-09-10T15:00:00Z');
let lancamentos = [
  { ...base, barbeariaId: 'a', valor: 40, data: dia, barbeiroId: 'b', categoria: 'Corte avulso' },
  { ...base, barbeariaId: 'a', valor: 20, data: dia },
  { ...base, barbeariaId: 'a', valor: 60, data: dia, servicoId: 's', agendamentoId: 'ag', agendamento: { servicoId: 's', servicosIds: ['s', 's2'] } },
  { ...base, barbeariaId: 'a', valor: 100, data: dia, categoria: 'Aporte' },
  { ...base, barbeariaId: 'a', valor: 50, data: dia, categoria: 'Venda de Produto', servicoId: 's', barbeiroId: 'b' },
  { ...base, barbeariaId: 'a', valor: 10, data: dia, tipo: 'SAIDA' },
  { ...base, barbeariaId: 'a', valor: 20, data: new Date('2026-09-09T15:00:00Z') },
  { ...base, barbeariaId: 'outra', valor: 80, data: dia },
];

// Serviço e extensão de tenant reais; apenas a persistência é controlada em memória.
(globalThis as typeof globalThis & { prisma?: unknown }).prisma = {
  $extends(extension: Extension) {
    const delegate = (model: string) => ({ findMany: async (args: { where?: Where } = {}) =>
      extension.query.$allModels.$allOperations({ model, operation: 'findMany', args, query: async ({ where }) => {
        if (model !== 'LancamentoFinanceiro') return [];
        return lancamentos.filter(l => (!where?.barbeariaId || l.barbeariaId === where.barbeariaId)
          && (!where?.data || (l.data >= where.data.gte && l.data <= where.data.lte)));
      } }) });
    return { lancamentoFinanceiro: delegate('LancamentoFinanceiro'), agendamento: delegate('Agendamento'), estoque: delegate('Estoque'), servico: delegate('Servico') };
  },
};

async function main() {
  const { FinanceiroService } = await import('../src/services/financeiro.service');
  const resumo = (tenant: string, fim: string) => tenantStorage.run({ barbeariaId: tenant }, () => FinanceiroService.dashboardResumo('2026-09-10', fim));
  for (const fim of ['2026-09-10', '2026-09-11']) {
    const r = await resumo('a', fim);
    assert.equal(r.atendimentosFechados, 3, 'manual com barbeiro, manual por categoria e combo contam uma vez cada');
    assert.equal(r.totalAtendimentos, 0, 'card da agenda não recebe lançamentos manuais');
    assert.equal(r.ticketMedio, 40);
    assert.equal(r.faturamentoTotal, 270, 'não altera faturamento');
    assert.equal(r.metricas.atendimentosFechados.anterior, 1);
    assert.equal(r.variacaoAtendimentosFechados, 200);
    assert.equal(r.metricas.atendimentosFechados.serie.reduce((a, b) => a + b, 0), 3);
    assert.equal(r.metricas.ticketMedio.serie.find(v => v > 0), 40, 'ticket da série não inclui aporte ou produto');
    assert.equal(r.metricas.atendimentosFechados.serie.length, fim === '2026-09-10' ? 24 : 2);
  }
  assert.equal((await resumo('outra', '2026-09-10')).atendimentosFechados, 1);
  lancamentos = [];
  const vazio = await resumo('a', '2026-09-10');
  assert.equal(vazio.atendimentosFechados, 0);
  assert.equal(vazio.ticketMedio, 0);
  console.log('PASS dashboard: manuais, combo único, produtos/saídas/aporte excluídos, ticket, comparativo, séries por hora/dia, duas barbearias e vazio.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
