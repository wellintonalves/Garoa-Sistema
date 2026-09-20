import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ErroDeNegocio } from '../lib/erros';
import { LIMITES_PLANO_BASICO, deveAvisarLimiteClientes } from '../domain/assinatura/regrasAssinatura';

type Banco = Prisma.TransactionClient | typeof prisma;

export async function obterUsoAssinatura(banco: Banco, barbeariaId: string) {
  const assinatura = await banco.assinaturaSaas.findUnique({
    where: { barbeariaId },
    select: { plano: true, status: true },
  });

  if (!assinatura || assinatura.plano === 'PRO') {
    return { gerenciada: Boolean(assinatura), plano: assinatura?.plano || null, barbeirosAtivos: 0, clientesAtivos: 0, avisarClientes: false };
  }

  const [barbeirosAtivos, clientes] = await Promise.all([
    banco.barbeiro.count({ where: { barbeariaId, ativo: true } }),
    banco.cliente.findMany({
      where: {
        OR: [
          // O vínculo explícito prevalece sobre o campo legado: arquivar não
          // pode continuar consumindo uma vaga por causa de Cliente.barbeariaId.
          { barbeariaId, clientesBarbearias: { none: { barbeariaId } } },
          { clientesBarbearias: { some: { barbeariaId, ativo: true } } },
        ],
      },
      select: { id: true },
    }),
  ]);
  const clientesAtivos = clientes.length;

  return {
    gerenciada: true,
    plano: assinatura.plano,
    barbeirosAtivos,
    clientesAtivos,
    avisarClientes: deveAvisarLimiteClientes(clientesAtivos),
  };
}

export async function validarVagaBarbeiro(banco: Banco, barbeariaId: string) {
  const uso = await obterUsoAssinatura(banco, barbeariaId);
  if (uso.gerenciada && uso.plano === 'BASICO' && uso.barbeirosAtivos >= LIMITES_PLANO_BASICO.barbeirosAtivos) {
    throw new ErroDeNegocio('O plano Básico permite até 8 barbeiros ativos. Desative um barbeiro antes de criar ou reativar outro.', 409);
  }
  return uso;
}

export async function validarVagaCliente(banco: Banco, barbeariaId: string) {
  const uso = await obterUsoAssinatura(banco, barbeariaId);
  if (uso.gerenciada && uso.plano === 'BASICO' && uso.clientesAtivos >= LIMITES_PLANO_BASICO.clientesAtivos) {
    throw new ErroDeNegocio('O plano Básico permite até 200 clientes ativos. Arquive um cliente antes de adicionar ou reativar outro.', 409);
  }
  return uso;
}

export async function executarSerializavel<T>(operacao: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    try {
      return await prisma.$transaction(operacao, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2034' || tentativa === 3) throw error;
    }
  }
  throw new Error('Não foi possível concluir a operação concorrente.');
}
