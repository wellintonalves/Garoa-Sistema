import assert from 'node:assert/strict';
const unidades = new Map<string, any>([['a', { id: 'a', legadoAssinatura: true, avisoMigracaoEm: null }], ['b', { id: 'b', legadoAssinatura: true, avisoMigracaoEm: null }]]);
const fake = {
  usuario: { findFirst: async ({ where }: any) => where.id === 'admin-a' && where.barbeariaId === 'a' ? { id: where.id } : null },
  assinaturaSaas: { findUnique: async () => null },
  barbearia: {
    findUnique: async ({ where }: any) => unidades.get(where.id),
    updateMany: async ({ where, data }: any) => {
      const b = unidades.get(where.id);
      if (!b?.legadoAssinatura || b.avisoMigracaoEm) return { count: 0 };
      Object.assign(b, data); return { count: 1 };
    },
  },
};
(globalThis as any).prisma = { $extends: () => fake };
async function main() {
  const { TransicaoLegadoService: service, resumirTransicaoLegado: resumo } = await import('../src/services/transicaoLegado.service');
  const admin = { id: 'admin-a', papel: 'ADMIN', barbeariaId: 'a' } as any;
  const on = { configurado: true } as any;
  const off = { configurado: false } as any;
  const inicio = new Date('2026-09-15T12:00:00-03:00');
  await service.registrarAviso(admin, off, inicio);
  assert.equal(unidades.get('a').avisoMigracaoEm, null, 'cobrança desativada não inicia prazo');
  assert.equal((await service.resumo('a', null, on, inicio)).status, 'AGUARDANDO_AVISO');
  assert.equal(unidades.get('a').avisoMigracaoEm, null, 'GET não inicia aviso');
  const primeiro = await service.registrarAviso(admin, on, inicio);
  assert.equal(primeiro.prazoAte?.toISOString(), '2026-09-20T15:00:00.000Z');
  assert.equal(primeiro.elegivelTeste, false);
  await Promise.all([service.registrarAviso(admin, on, new Date('2026-09-16')), service.registrarAviso(admin, on, new Date('2026-09-17'))]);
  assert.equal(unidades.get('a').prazoMigracaoAte.getTime(), primeiro.prazoAte!.getTime(), 'repetição não reinicia prazo');
  assert.equal(unidades.get('b').avisoMigracaoEm, null);
  await assert.rejects(service.registrarAviso({ ...admin, barbeariaId: 'b' }, on), /Administrador autorizado/);
  const b = unidades.get('a');
  assert.equal(resumo(b, null, true, new Date('2026-09-20T14:59:59Z')).status, 'PRAZO_MIGRACAO');
  assert.equal(resumo(b, null, true, new Date('2026-09-20T15:00:00Z')).status, 'CONSULTA_EXPORTACAO');
  assert.equal(resumo(b, { status: 'PRE_CADASTRO' }, true, new Date('2026-09-21')).status, 'CONSULTA_EXPORTACAO', 'checkout não desbloqueia');
  assert.equal(resumo(b, { status: 'ATIVA' }, true, new Date('2026-09-21')).status, 'MIGRADA', 'pagamento recupera acesso');
  assert.equal(resumo(b, null, false, new Date('2026-09-21')).status, 'AGUARDANDO_DISPONIBILIDADE');
  assert.equal(resumo(b, null, true, new Date('2026-10-20T15:00:00Z')).status, 'ENCERRADA');
  assert.equal(resumo({ legadoAssinatura: false }, null, true).elegivelTeste, true);
  console.log('Transição legada: cinco dias, idempotência, isolamento, disponibilidade e recuperação passaram.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
