import assert from 'node:assert/strict';

const assinaturas = new Map<string, any>([
  ['basico', { plano: 'BASICO', status: 'ATIVA', fimAcessoEm: null }],
  ['pro', { plano: 'PRO', status: 'ATIVA', fimAcessoEm: null }],
  ['somente-leitura', { plano: 'BASICO', status: 'CONSULTA_EXPORTACAO', fimAcessoEm: new Date('2026-09-01T00:00:00Z') }],
]);
const uso = new Map<string, { barbeiros: number; clientes: number }>([
  ['basico', { barbeiros: 8, clientes: 200 }],
  ['pro', { barbeiros: 40, clientes: 5000 }],
]);
let consultasAssinatura = 0;

const fake = {
  barbearia: { findUnique: async () => ({ legadoAssinatura: false }) },
  assinaturaSaas: {
    findUnique: async ({ where }: any) => {
      consultasAssinatura += 1;
      return assinaturas.get(where.barbeariaId) || null;
    },
  },
  barbeiro: {
    count: async ({ where }: any) => uso.get(where.barbeariaId)?.barbeiros || 0,
  },
  cliente: {
    findMany: async ({ where }: any) => {
      const barbeariaId = where.OR[0].barbeariaId;
      return Array.from({ length: uso.get(barbeariaId)?.clientes || 0 }, (_, indice) => ({ id: `${barbeariaId}-${indice}` }));
    },
  },
};

(globalThis as typeof globalThis & { prisma?: unknown }).prisma = { $extends: () => fake };

async function main() {
  const { obterUsoAssinatura, validarVagaBarbeiro, validarVagaCliente } = await import('../src/services/limitesAssinatura.service');
  const { validarEscritaAssinatura } = await import('../src/services/acessoAssinatura.service');

  const legado = await obterUsoAssinatura(fake as any, 'legado');
  assert.equal(legado.gerenciada, false);

  const pro = await obterUsoAssinatura(fake as any, 'pro');
  assert.equal(pro.plano, 'PRO');
  await validarVagaBarbeiro(fake as any, 'pro');
  await validarVagaCliente(fake as any, 'pro');

  await assert.rejects(validarVagaBarbeiro(fake as any, 'basico'), /8 barbeiros ativos/);
  await assert.rejects(validarVagaCliente(fake as any, 'basico'), /200 clientes ativos/);

  uso.set('basico', { barbeiros: 7, clientes: 179 });
  const abaixo = await validarVagaCliente(fake as any, 'basico');
  assert.equal(abaixo.avisarClientes, false);
  uso.set('basico', { barbeiros: 7, clientes: 180 });
  assert.equal((await validarVagaCliente(fake as any, 'basico')).avisarClientes, true);

  const antesGet = consultasAssinatura;
  await validarEscritaAssinatura('somente-leitura', 'GET', '/api/clientes');
  assert.equal(consultasAssinatura, antesGet + 1, 'leituras verificam o encerramento da transição');
  await assert.rejects(
    validarEscritaAssinatura('somente-leitura', 'POST', '/api/clientes'),
    /consulta e exportação/,
  );
  await validarEscritaAssinatura('somente-leitura', 'POST', '/api/assinatura/cancelamento');
  await validarEscritaAssinatura('legado', 'POST', '/api/clientes');

  console.log('✅ Limites e acesso: legado, Pró, Básico, aviso 180, teto 8/200 e modo somente leitura.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
