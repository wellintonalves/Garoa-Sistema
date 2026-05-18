// Serviço de barbeiros — CRUD completo
import { prisma } from '../lib/prisma';

interface DadosBarbeiro {
  nome: string;
  email: string;
  senha: string;
  foto?: string;
  especialidades?: string[];
  comissaoPercent?: number;
}

interface DadosAtualizacao {
  foto?: string;
  especialidades?: string[];
  comissaoPercent?: number;
  ativo?: boolean;
}

export class BarbeiroService {
  /** Lista todos os barbeiros ativos */
  static async listarTodos() {
    return prisma.barbeiro.findMany({
      include: {
        usuario: {
          select: { id: true, nome: true, email: true, papel: true },
        },
      },
      orderBy: { usuario: { nome: 'asc' } },
    });
  }

  /** Busca barbeiro por ID */
  static async buscarPorId(id: string) {
    const barbeiro = await prisma.barbeiro.findUnique({
      where: { id },
      include: {
        usuario: {
          select: { id: true, nome: true, email: true, papel: true },
        },
      },
    });

    if (!barbeiro) {
      throw new Error('Barbeiro não encontrado');
    }

    return barbeiro;
  }

  /** Busca barbeiro pelo ID do usuário */
  static async buscarPorUsuarioId(usuarioId: string) {
    return prisma.barbeiro.findUnique({
      where: { usuarioId },
      include: {
        usuario: {
          select: { id: true, nome: true, email: true, papel: true },
        },
      },
    });
  }

  /** Cria um novo barbeiro (com usuário) */
  static async criar(dados: DadosBarbeiro) {
    const bcrypt = await import('bcryptjs');
    const senhaHash = await bcrypt.hash(dados.senha, 10);

    return prisma.barbeiro.create({
      data: {
        foto: dados.foto,
        especialidades: dados.especialidades || [],
        comissaoPercent: dados.comissaoPercent || 50,
        usuario: {
          create: {
            nome: dados.nome,
            email: dados.email,
            senha: senhaHash,
            papel: 'BARBEIRO',
          },
        },
      },
      include: {
        usuario: {
          select: { id: true, nome: true, email: true, papel: true },
        },
      },
    });
  }

  /** Atualiza dados do barbeiro */
  static async atualizar(id: string, dados: DadosAtualizacao) {
    return prisma.barbeiro.update({
      where: { id },
      data: dados,
      include: {
        usuario: {
          select: { id: true, nome: true, email: true, papel: true },
        },
      },
    });
  }

  /** Desativa um barbeiro (soft delete) */
  static async desativar(id: string) {
    return prisma.barbeiro.update({
      where: { id },
      data: { ativo: false },
    });
  }
}
