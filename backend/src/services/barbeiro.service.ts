// Serviço de barbeiros — CRUD completo
import { prisma } from '../lib/prisma';

interface DadosBarbeiro {
  nome: string;
  email: string;
  senha: string;
  foto?: string;
  especialidades?: string[];
  comissaoPercent?: number;
  cor?: string;
}

interface DadosAtualizacao {
  nome?: string;
  email?: string;
  senha?: string;
  foto?: string;
  especialidades?: string[];
  comissaoPercent?: number;
  cor?: string;
  ativo?: boolean;
  trabalhandoAgora?: boolean;
}

export class BarbeiroService {
  /** Lista todos os barbeiros */
  static async listarTodos(barbeariaId?: string, apenasAtivos: boolean = true) {
    const where: any = {};
    if (barbeariaId) where.barbeariaId = barbeariaId;
    if (apenasAtivos) where.ativo = true;

    return prisma.barbeiro.findMany({
      where,
      include: {
        usuario: {
          select: { id: true, nome: true, email: true, papel: true },
        },
        _count: {
          select: { agendamentos: true, comissoes: true, movimentacoes: true }
        }
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
  static async criar(dados: DadosBarbeiro, barbeariaId?: string) {
    const bcrypt = await import('bcryptjs');
    const senhaHash = await bcrypt.hash(dados.senha, 10);

    return prisma.barbeiro.create({
      data: {
        foto: dados.foto || null,
        especialidades: dados.especialidades || [],
        comissaoPercent: dados.comissaoPercent || 50,
        cor: dados.cor || '#F97316',
        barbearia: barbeariaId ? { connect: { id: barbeariaId } } : undefined,
        usuario: {
          create: {
            nome: dados.nome,
            email: dados.email,
            senha: senhaHash,
            papel: 'BARBEIRO',
            barbearia: barbeariaId ? { connect: { id: barbeariaId } } : undefined,
          },
        },
      } as any,
      include: {
        usuario: {
          select: { id: true, nome: true, email: true, papel: true },
        },
      },
    });
  }

  /** Atualiza dados do barbeiro (incluindo email/senha do usuario) */
  static async atualizar(id: string, dados: DadosAtualizacao) {
    const barbeiro = await prisma.barbeiro.findUnique({ where: { id } });
    if (!barbeiro) throw new Error('Barbeiro não encontrado');

    // Atualiza dados do usuario se nome, email ou senha foram passados
    if (dados.nome || dados.email || dados.senha) {
      const updateUser: Record<string, unknown> = {};
      if (dados.nome) updateUser.nome = dados.nome;
      if (dados.email) updateUser.email = dados.email;
      if (dados.senha) {
        const bcrypt = await import('bcryptjs');
        updateUser.senha = await bcrypt.hash(dados.senha, 10);
      }
      await prisma.usuario.update({
        where: { id: barbeiro.usuarioId },
        data: updateUser,
      });
    }

    // Atualiza dados do barbeiro
    const updateBarbeiro: Record<string, unknown> = {};
    if (dados.foto !== undefined) updateBarbeiro.foto = dados.foto || null;
    if (dados.especialidades !== undefined) updateBarbeiro.especialidades = dados.especialidades;
    if (dados.comissaoPercent !== undefined) updateBarbeiro.comissaoPercent = dados.comissaoPercent;
    if (dados.cor !== undefined) updateBarbeiro.cor = dados.cor;
    if (dados.ativo !== undefined) updateBarbeiro.ativo = dados.ativo;
    if (dados.trabalhandoAgora !== undefined) updateBarbeiro.trabalhandoAgora = dados.trabalhandoAgora;

    return prisma.barbeiro.update({
      where: { id },
      data: updateBarbeiro,
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
      data: { ativo: false } as never,
    });
  }

  /** Exclui permanentemente um barbeiro se não tiver vínculos */
  static async excluirPermanentemente(id: string) {
    const barbeiro = await prisma.barbeiro.findUnique({
      where: { id },
      include: {
        _count: {
          select: { agendamentos: true, comissoes: true, movimentacoes: true }
        }
      }
    });

    if (!barbeiro) {
      throw new Error('Barbeiro não encontrado');
    }

    const { agendamentos, comissoes, movimentacoes } = barbeiro._count;
    if (agendamentos > 0 || comissoes > 0 || movimentacoes > 0) {
      throw new Error('Este barbeiro possui histórico de atendimentos e não pode ser excluído. Ele permanecerá nos relatórios, mas não aparecerá na agenda nem em novos agendamentos.');
    }

    // Exclui o barbeiro e o usuário associado (dependendo do schema, se onDelete: Cascade, excluir usuario é suficiente)
    // Como a FK geralmente está em barbeiro referenciando usuario, excluímos barbeiro e depois o usuário.
    return prisma.$transaction(async (tx) => {
      await tx.barbeiro.delete({ where: { id } });
      await tx.usuario.delete({ where: { id: barbeiro.usuarioId } });
    });
  }
}

