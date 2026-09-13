import assert from 'node:assert/strict';
import { tenantStorage } from '../src/lib/als';

let vinculo: 'original' | 'estorno' | null = 'original';
let gravacoes = 0;
const registro = () => ({ id: 'l', barbeariaId: 'loja', tipo: 'ENTRADA', categoria: 'Aporte',
  valor: 90, barbeiroId: null, clienteId: null, servicoId: null, itens: [], agendamento: null,
  vendaEstoque: vinculo === 'original' ? { id: 'v' } : null,
  estornoVendaEstoque: vinculo === 'estorno' ? { id: 'v' } : null });
const fake = {
  lancamentoFinanceiro: {
    findFirst: async () => registro(), findUnique: async () => registro(),
    update: async ({ data }: { data: Record<string, unknown> }) => { gravacoes++; return { ...registro(), ...data }; },
    delete: async () => { gravacoes++; return registro(); },
  },
  $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(fake),
};
(globalThis as typeof globalThis & { prisma?: unknown }).prisma = { $extends: () => fake };
async function main() {
  const { FinanceiroService } = await import('../src/services/financeiro.service');
  await tenantStorage.run({ barbeariaId: 'loja' }, async () => {
    for (const modo of ['original', 'estorno'] as const) {
      vinculo = modo;
      await assert.rejects(FinanceiroService.atualizar('l', { valor: 1 }, true), /não podem ser editados/);
      await assert.rejects(FinanceiroService.remover('l', true), /preserva o histórico/);
    }
    assert.equal(gravacoes, 0);
    vinculo = null;
    const normal = await FinanceiroService.atualizar('l', { valor: 100 }, true);
    assert.ok('valor' in normal); assert.equal(Number(normal.valor), 100);
    await FinanceiroService.remover('l', true);
    assert.equal(gravacoes, 2);
  });
  console.log('PASS proteção: original/estorno bloqueados sem escrita, demais lançamentos editáveis/removíveis.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
