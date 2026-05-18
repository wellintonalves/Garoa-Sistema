// Serviço de clientes — CRUD completo
import { prisma } from '../lib/prisma';

interface DadosCliente {
  nome: string;
  email: string;
  senha: string;
  telefone?: string;
  dataNascimento?: string;
  observacoes?: string;
}

interface DadosAtualizacao {
  telefone?: string;
  dataNascimento?: string;
  observacoes?: string;
}

export class ClienteService {
  /** Lista todos os clientes */
  static async listarTodos() {
    return prisma.cliente.findMany({
      include: {
        usuario: {
          select: { id: true, nome: true, email: true },
        },
      },
      orderBy: { usuario: { nome: 'asc' } },
    });
  }

  /** Busca cliente por ID */
  static async buscarPorId(id: string) {
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: {
        usuario: {
          select: { id: true, nome: true, email: true },
        },
        agendamentos: {
          include: {
            servico: true,
            barbeiro: { include: { usuario: { select: { nome: true } } } },
          },
          orderBy: { dataHora: 'desc' },
          take: 20,
        },
      },
    });

    if (!cliente) {
      throw new Error('Cliente não encontrado');
    }

    return cliente;
  }

  /** Busca clientes por nome ou telefone */
  static async buscar(termo: string) {
    return prisma.cliente.findMany({
      where: {
        OR: [
          { usuario: { nome: { contains: termo, mode: 'insensitive' } } },
          { telefone: { contains: termo } },
        ],
      },
      include: {
        usuario: {
          select: { id: true, nome: true, email: true },
        },
      },
    });
  }

  /** Cria um novo cliente (com usuário) */
  static async criar(dados: DadosCliente) {
    const bcrypt = await import('bcryptjs');
    const senhaHash = await bcrypt.hash(dados.senha, 10);

    return prisma.cliente.create({
      data: {
        telefone: dados.telefone,
        dataNascimento: dados.dataNascimento ? new Date(dados.dataNascimento) : null,
        observacoes: dados.observacoes,
        usuario: {
          create: {
            nome: dados.nome,
            email: dados.email,
            senha: senhaHash,
            papel: 'CLIENTE',
          },
        },
      },
      include: {
        usuario: {
          select: { id: true, nome: true, email: true },
        },
      },
    });
  }

  /** Atualiza dados do cliente */
  static async atualizar(id: string, dados: DadosAtualizacao) {
    return prisma.cliente.update({
      where: { id },
      data: {
        ...dados,
        dataNascimento: dados.dataNascimento ? new Date(dados.dataNascimento) : undefined,
      },
      include: {
        usuario: {
          select: { id: true, nome: true, email: true },
        },
      },
    });
  }

  /** Remove um cliente */
  static async remover(id: string) {
    // Remove o cliente e o usuário associado (cascade)
    const cliente = await prisma.cliente.findUnique({ where: { id } });
    if (!cliente) throw new Error('Cliente não encontrado');

    await prisma.cliente.delete({ where: { id } });
    await prisma.usuario.delete({ where: { id: cliente.usuarioId } });
  }
}
