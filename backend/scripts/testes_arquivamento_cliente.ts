import assert from 'node:assert/strict';

const cliente = { id: 'cliente-compartilhado', usuarioId: 'usuario-cliente', barbeariaId: 'barbearia-a' as string | null };
const usuario = { id: 'usuario-cliente', papel: 'CLIENTE', barbeariaId: 'barbearia-a' as string | null };
const vinculos = new Map([
  ['barbearia-b', { id: 'vinculo-b', clienteId: cliente.id, barbeariaId: 'barbearia-b', ativo: true, arquivadoEm: null as Date | null }],
]);

const fake: any = {
  cliente: {
    findUnique: async ({ where }: any) => where.id === cliente.id ? { ...cliente } : null,
    update: async ({ data }: any) => Object.assign(cliente, data),
  },
  usuario: {
    updateMany: async ({ where, data }: any) => {
      if (where.id === usuario.id && where.barbeariaId === usuario.barbeariaId) Object.assign(usuario, data);
      return { count: 1 };
    },
  },
  clienteBarbearia: {
    findUnique: async ({ where }: any) => vinculos.get(where.clienteId_barbeariaId.barbeariaId) || null,
    upsert: async ({ where, create, update }: any) => {
      const chave = where.clienteId_barbeariaId.barbeariaId;
      const atual = vinculos.get(chave);
      if (atual) Object.assign(atual, update);
      else vinculos.set(chave, { id: `vinculo-${chave}`, ...create });
      return vinculos.get(chave);
    },
  },
};
fake.$transaction = async (operacao: any) => operacao(fake);
(globalThis as typeof globalThis & { prisma?: unknown }).prisma = { $extends: () => fake };

async function main() {
  const { ClienteService } = await import('../src/services/cliente.service');

  await ClienteService.remover(cliente.id, 'barbearia-a');
  assert.equal(cliente.barbeariaId, null);
  assert.equal(usuario.barbeariaId, null);
  assert.equal(vinculos.get('barbearia-a')?.ativo, false);
  assert.ok(vinculos.get('barbearia-a')?.arquivadoEm instanceof Date);
  assert.equal(vinculos.get('barbearia-b')?.ativo, true, 'outra unidade permanece ativa');

  await ClienteService.remover(cliente.id, 'barbearia-b');
  assert.equal(vinculos.get('barbearia-b')?.ativo, false);
  await assert.rejects(ClienteService.remover(cliente.id, 'barbearia-c'), /não pertence/);

  assert.equal(typeof fake.cliente.delete, 'undefined', 'fluxo não possui exclusão física do cliente');
  assert.equal(typeof fake.usuario.delete, 'undefined', 'fluxo não possui exclusão física do usuário');
  console.log('✅ Arquivamento: unidade isolada, conta e histórico preservados, sem exclusão física.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
