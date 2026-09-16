import assert from 'node:assert/strict';
import { prazoRetencaoFinanceira, avaliarRetencaoFinanceira } from '../src/domain/privacidade/retencaoOperacional';

async function main() {
  assert.equal(prazoRetencaoFinanceira(new Date('2024-02-29T15:45:12.123Z')).toISOString(), '2025-02-28T15:45:12.123Z');
  assert.equal(prazoRetencaoFinanceira(new Date('2023-03-01T01:00:00Z')).toISOString(), '2024-02-29T01:00:00.000Z', 'calendário Brasília: 28 fevereiro 22h');
  const fim = new Date('2025-01-31T12:00:00Z');
  assert.equal(prazoRetencaoFinanceira(fim).toISOString(), '2026-01-31T12:00:00.000Z');
  assert.equal(avaliarRetencaoFinanceira(fim, new Date('2026-01-31T11:59:59Z'), false), 'RETENCAO_OPERACIONAL');
  assert.equal(avaliarRetencaoFinanceira(fim, new Date('2026-01-31T12:00:00Z'), false), 'REVISAO_NECESSARIA');
  assert.equal(avaliarRetencaoFinanceira(fim, new Date('2027-01-31T12:00:00Z'), true), 'RETENCAO_LEGAL_REVISAVEL');
  assert.throws(() => prazoRetencaoFinanceira(new Date('invalid')), /inválido/);
  const filas = new Map<string, any>();
  const fake: any = {
    assinaturaSaas: { findMany: async () => [{ id: 's', barbeariaId: 'b', fimAcessoEm: fim, consultaExportacaoAte: new Date('2025-03-02T12:00:00Z') }] },
    exclusaoDadosAuditavel: {
      createMany: async ({ data }: any) => { for (const item of data) { const key = item.entidade + item.registroId; if (!filas.has(key)) filas.set(key, { ...item, excluidoPrincipalEm: null }); } },
      updateMany: async ({ where, data }: any) => {
        const item = filas.get(where.entidade + where.registroId);
        if (item && item.retencaoLegal === false && item.status === 'AGUARDANDO_POLITICA' && item.excluidoPrincipalEm === null) Object.assign(item, data);
      },
    },
  };
  const { triarRetencaoEncerramentos } = await import('../src/services/retencaoOperacional.service');
  await triarRetencaoEncerramentos(fake, new Date('2025-03-02T11:59:59Z')); assert.equal(filas.size, 0);
  await triarRetencaoEncerramentos(fake, new Date('2025-03-02T12:00:00Z')); assert.equal(filas.size, 2);
  await triarRetencaoEncerramentos(fake, new Date('2026-01-31T12:00:00Z')); assert.equal(filas.size, 2);
  const financeiro = filas.get('REVISAO_FINANCEIRO_ASSINATURAs');
  assert.match(financeiro.motivoRetencao, /REVISAO_NECESSARIA/);
  assert.equal(financeiro.retencaoLegal, false); assert.equal(financeiro.excluidoPrincipalEm, null);
  financeiro.retencaoLegal = true; financeiro.motivoRetencao = 'Disputa sob revisão documentada';
  await triarRetencaoEncerramentos(fake, new Date('2027-01-31T12:00:00Z'));
  assert.equal(financeiro.motivoRetencao, 'Disputa sob revisão documentada');
  assert.equal(typeof fake.exclusaoDadosAuditavel.delete, 'undefined');
  console.log('PASS retenção operacional: calendário Brasília/bissexto, janela30dias, idempotência, revisão após12meses, hold preservado, zero deletes.');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
