import assert from 'node:assert/strict';

type Preferencia = {
  clienteId: string;
  origem: 'VALEN' | 'BARBEARIA';
  chaveOrigem: string;
  barbeariaId: string | null;
  emailHabilitado: boolean;
  emailAlteradoEm: Date | null;
  inAppHabilitado: boolean;
  inAppAlteradoEm: Date | null;
};

const clientes = new Map([
  ['cliente-adulto', { dataNascimento: new Date('1990-05-10T12:00:00Z') }],
  ['cliente-menor', { dataNascimento: new Date('2012-05-10T12:00:00Z') }],
  ['cliente-legado', { dataNascimento: null }],
  ['cliente-outro', { dataNascimento: new Date('1988-01-01T12:00:00Z') }],
]);
const conexoes = [
  { clienteId: 'cliente-adulto', barbeariaId: 'barbearia-a', ativo: true, barbearia: { nome: 'Barbearia A' } },
  { clienteId: 'cliente-adulto', barbeariaId: 'barbearia-b', ativo: true, barbearia: { nome: 'Barbearia B' } },
  { clienteId: 'cliente-outro', barbeariaId: 'barbearia-b', ativo: true, barbearia: { nome: 'Barbearia B' } },
];
const preferencias: Preferencia[] = [];

const fake = {
  cliente: {
    findUnique: async ({ where }: any) => clientes.get(where.id) || null,
  },
  clienteBarbearia: {
    findMany: async ({ where }: any) => conexoes
      .filter((item) => item.clienteId === where.clienteId && item.ativo === where.ativo)
      .map(({ barbeariaId, barbearia }) => ({ barbeariaId, barbearia })),
    findFirst: async ({ where }: any) => conexoes.find((item) =>
      item.clienteId === where.clienteId &&
      item.barbeariaId === where.barbeariaId &&
      item.ativo === where.ativo
    ) || null,
  },
  preferenciaPromocional: {
    findMany: async ({ where }: any) => preferencias.filter((item) => item.clienteId === where.clienteId),
    upsert: async ({ where, create, update }: any) => {
      const existente = preferencias.find((item) =>
        item.clienteId === where.clienteId_chaveOrigem.clienteId &&
        item.chaveOrigem === where.clienteId_chaveOrigem.chaveOrigem
      );
      if (existente) {
        Object.assign(existente, update);
        return existente;
      }
      const nova: Preferencia = {
        emailHabilitado: false,
        emailAlteradoEm: null,
        inAppHabilitado: false,
        inAppAlteradoEm: null,
        ...create,
      };
      preferencias.push(nova);
      return nova;
    },
  },
};

(globalThis as typeof globalThis & { prisma?: unknown }).prisma = { $extends: () => fake };

async function main() {
  const { ClienteAppService } = await import('../src/services/clienteApp.service');

  const iniciais = await ClienteAppService.preferenciasPromocionais('cliente-adulto');
  assert.deepEqual(iniciais.map((item) => item.nome), ['Valen Barber', 'Barbearia A', 'Barbearia B']);
  assert.ok(iniciais.every((item) => !item.emailHabilitado && !item.inAppHabilitado));

  await ClienteAppService.atualizarPreferenciaPromocional('cliente-adulto', {
    origem: 'VALEN', canal: 'EMAIL', habilitado: true,
  });
  await ClienteAppService.atualizarPreferenciaPromocional('cliente-adulto', {
    origem: 'BARBEARIA', barbeariaId: 'barbearia-a', canal: 'IN_APP', habilitado: true,
  });

  const atualizadas = await ClienteAppService.preferenciasPromocionais('cliente-adulto');
  assert.equal(atualizadas[0].emailHabilitado, true);
  assert.equal(atualizadas[0].inAppHabilitado, false);
  assert.equal(atualizadas[1].emailHabilitado, false);
  assert.equal(atualizadas[1].inAppHabilitado, true);
  assert.equal(atualizadas[2].emailHabilitado, false);
  assert.equal(atualizadas[2].inAppHabilitado, false);

  const outroCliente = await ClienteAppService.preferenciasPromocionais('cliente-outro');
  assert.ok(outroCliente.every((item) => !item.emailHabilitado && !item.inAppHabilitado));

  await assert.rejects(
    ClienteAppService.atualizarPreferenciaPromocional('cliente-adulto', {
      origem: 'BARBEARIA', barbeariaId: 'barbearia-sem-vinculo', canal: 'EMAIL', habilitado: true,
    }),
    /não está conectado/,
  );
  await assert.rejects(
    ClienteAppService.atualizarPreferenciaPromocional('cliente-menor', {
      origem: 'VALEN', canal: 'EMAIL', habilitado: true,
    }),
    /idade mínima de 18 anos/,
  );
  await assert.rejects(
    ClienteAppService.atualizarPreferenciaPromocional('cliente-legado', {
      origem: 'VALEN', canal: 'IN_APP', habilitado: true,
    }),
    /data de nascimento informada/,
  );
  await ClienteAppService.atualizarPreferenciaPromocional('cliente-legado', {
    origem: 'VALEN', canal: 'EMAIL', habilitado: false,
  });

  await ClienteAppService.atualizarPreferenciaPromocional('cliente-adulto', {
    origem: 'VALEN', canal: 'EMAIL', habilitado: false,
  });
  assert.equal(preferencias.find((item) => item.clienteId === 'cliente-adulto' && item.chaveOrigem === 'VALEN')?.emailHabilitado, false);
  assert.ok(preferencias.every((item) => item.emailAlteradoEm || item.inAppAlteradoEm));

  console.log('✅ Preferências promocionais: opt-in/opt-out, canal, origem, menor, legado e isolamento validados.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
