import assert from 'node:assert/strict';
import type { UsuarioJWT } from '../src/types';

type Solicitacao = {
  id: string;
  barbeariaId: string;
  solicitadoPorId: string;
  solicitadoPorEmail: string;
  canal: 'SISTEMA' | 'EMAIL';
  status: 'PROCESSAMENTO_PENDENTE' | 'RENOVACAO_CANCELADA' | 'REJEITADA';
  chaveIdempotencia: string;
  aberta: boolean | null;
  recebidoEm: Date;
  updatedAt: Date;
  provedor: string;
  assinaturaExternaId: string | null;
  tentativasProvedor: number;
  ultimaTentativaEm: Date | null;
  ultimoErroProvedor: string | null;
  cancelamentoConfirmadoEm: Date | null;
  fimAcessoEm: Date | null;
  motivo: string | null;
};

const usuarios = [
  { id: 'admin-a', papel: 'ADMIN', barbeariaId: 'barbearia-a', email: ' Admin@A.test ' },
  { id: 'admin-b', papel: 'ADMIN', barbeariaId: 'barbearia-b', email: 'admin@b.test' },
];
const barbearias = [
  { id: 'barbearia-a', nome: 'Barbearia Árvore' },
  { id: 'barbearia-b', nome: 'Barbearia B' },
];
const solicitacoes: Solicitacao[] = [];

function combina<T extends Record<string, any>>(registro: T, where: Record<string, any>): boolean {
  return Object.entries(where).every(([chave, valor]) => {
    if (chave === 'status' && valor?.in) return valor.in.includes(registro[chave]);
    return registro[chave] === valor;
  });
}

const fake = {
  assinaturaSaas: { findUnique: async () => null },
  usuario: {
    findFirst: async ({ where }: { where: Record<string, any> }) =>
      usuarios.find((registro) => combina(registro, where)) || null,
  },
  barbearia: {
    findUnique: async ({ where }: { where: { id: string } }) =>
      barbearias.find((registro) => registro.id === where.id) || null,
  },
  solicitacaoCancelamentoAssinatura: {
    findUnique: async ({ where }: { where: { chaveIdempotencia: string } }) =>
      solicitacoes.find((registro) => registro.chaveIdempotencia === where.chaveIdempotencia) || null,
    findFirst: async ({ where }: { where: Record<string, any> }) =>
      [...solicitacoes].reverse().find((registro) => combina(registro, where)) || null,
    create: async ({ data }: { data: Partial<Solicitacao> }) => {
      await Promise.resolve();
      const conflito = solicitacoes.some(
        (registro) =>
          registro.chaveIdempotencia === data.chaveIdempotencia ||
          (registro.barbeariaId === data.barbeariaId &&
            registro.aberta === true && data.aberta !== null),
      );
      if (conflito) throw { code: 'P2002' };
      const agora = new Date('2026-09-15T12:00:00-03:00');
      const criada: Solicitacao = {
        id: `solicitacao-${solicitacoes.length + 1}`,
        barbeariaId: data.barbeariaId!,
        solicitadoPorId: data.solicitadoPorId!,
        solicitadoPorEmail: data.solicitadoPorEmail!,
        canal: data.canal || 'SISTEMA',
        status: data.status || 'PROCESSAMENTO_PENDENTE',
        chaveIdempotencia: data.chaveIdempotencia!,
        aberta: true,
        recebidoEm: agora,
        updatedAt: agora,
        provedor: 'ASAAS',
        assinaturaExternaId: null,
        tentativasProvedor: 0,
        ultimaTentativaEm: null,
        ultimoErroProvedor: null,
        cancelamentoConfirmadoEm: null,
        fimAcessoEm: null,
        motivo: data.motivo || null,
      };
      solicitacoes.push(criada);
      return criada;
    },
  },
};

(globalThis as typeof globalThis & { prisma?: unknown }).prisma = {
  $extends: () => fake,
};

const adminA: UsuarioJWT = {
  id: 'admin-a', nome: 'Admin A', email: 'admin@a.test', papel: 'ADMIN', barbeariaId: 'barbearia-a',
};

async function main() {
  const { AssinaturaService } = await import('../src/services/assinatura.service');
  const { provedorAssinatura } = await import('../src/integrations/assinaturas/provedorAssinatura');

  await assert.rejects(
    AssinaturaService.solicitarCancelamento(
      { ...adminA, papel: 'BARBEIRO' },
      { confirmacaoNome: 'Barbearia Árvore', chaveIdempotencia: 'pedido-0001' },
    ),
    /Somente o administrador/,
  );
  await assert.rejects(
    AssinaturaService.solicitarCancelamento(adminA, {
      confirmacaoNome: 'Outra barbearia', chaveIdempotencia: 'pedido-0002',
    }),
    /Digite o nome/,
  );

  const primeira = await AssinaturaService.solicitarCancelamento(adminA, {
    confirmacaoNome: 'Barbearia Arvore',
    chaveIdempotencia: 'pedido-0003',
    motivo: 'Mudança de fornecedor',
  });
  assert.equal(primeira.nova, true);
  assert.equal(primeira.solicitacao.status, 'PROCESSAMENTO_PENDENTE');
  assert.equal(primeira.solicitacao.solicitadoPorEmail, 'admin@a.test');
  assert.equal(primeira.solicitacao.cancelamentoConfirmadoEm, null);
  assert.equal(primeira.solicitacao.fimAcessoEm, null);
  assert.equal(primeira.integracao.estado, 'NAO_CONFIGURADO');

  const repetida = await AssinaturaService.solicitarCancelamento(adminA, {
    confirmacaoNome: 'Barbearia Árvore', chaveIdempotencia: 'pedido-0003',
  });
  assert.equal(repetida.nova, false);
  assert.equal(repetida.solicitacao.id, primeira.solicitacao.id);

  const outraChave = await AssinaturaService.solicitarCancelamento(adminA, {
    confirmacaoNome: 'Barbearia Árvore', chaveIdempotencia: 'pedido-0004',
  });
  assert.equal(outraChave.nova, false, 'não cria segundo pedido aberto');
  assert.equal(solicitacoes.filter((item) => item.barbeariaId === 'barbearia-a').length, 1);

  const adminB: UsuarioJWT = {
    id: 'admin-b', nome: 'Admin B', email: 'admin@b.test', papel: 'ADMIN', barbeariaId: 'barbearia-b',
  };
  const [concorrenteA, concorrenteB] = await Promise.all([
    AssinaturaService.solicitarCancelamento(adminB, {
      confirmacaoNome: 'Barbearia B', chaveIdempotencia: 'pedido-b-0001',
    }),
    AssinaturaService.solicitarCancelamento(adminB, {
      confirmacaoNome: 'Barbearia B', chaveIdempotencia: 'pedido-b-0002',
    }),
  ]);
  assert.equal(solicitacoes.filter((item) => item.barbeariaId === 'barbearia-b').length, 1);
  assert.equal(concorrenteA.solicitacao.id, concorrenteB.solicitacao.id);

  const estadoA = await AssinaturaService.obterCancelamentoAtual(adminA);
  const estadoB = await AssinaturaService.obterCancelamentoAtual(adminB);
  assert.notEqual(estadoA.solicitacao?.id, estadoB.solicitacao?.id, 'isola barbearias');

  const resultadoProvedor = await provedorAssinatura.cancelarRenovacao({
    solicitacaoId: primeira.solicitacao.id,
    barbeariaId: 'barbearia-a',
    assinaturaExternaId: 'assinatura-teste',
    chaveIdempotencia: 'pedido-0003',
  });
  assert.equal(resultadoProvedor.estado, 'NAO_CONFIGURADO');
  assert.equal(resultadoProvedor.confirmadoEm, undefined);

  console.log('PASS cancelamento de assinatura: autorização, confirmação, recibo, idempotência, concorrência, isolamento e provedor desativado (persistência simulada; sem banco ou Asaas).');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
