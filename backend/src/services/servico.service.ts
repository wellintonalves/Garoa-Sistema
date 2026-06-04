// Serviço de serviços da barbearia — CRUD completo
import { prisma } from '../lib/prisma';

interface DadosServico {
  nome: string;
  descricao?: string;
  preco: number;
  duracaoMinutos: number;
  comissaoPercent?: number;
  cor?: string;
}

export class ServicoService {
  /** Lista todos os serviços ativos */
  static async listarTodos(barbeariaId?: string) {
    if (barbeariaId) {
      // Auto-correção: associa serviços órfãos à barbearia atual
      await prisma.servico.updateMany({
        where: { barbeariaId: null },
        data: { barbeariaId },
      });
    }

    return prisma.servico.findMany({
      where: { ativo: true, ...(barbeariaId ? { barbeariaId } : {}) },
      orderBy: { nome: 'asc' },
    });
  }

  /** Busca serviço por ID */
  static async buscarPorId(id: string) {
    const servico = await prisma.servico.findUnique({ where: { id } });
    if (!servico) throw new Error('Serviço não encontrado');
    return servico;
  }

  /** Cria um novo serviço */
  static async criar(dados: DadosServico, barbeariaId?: string) {
    return prisma.servico.create({
      data: {
        nome: dados.nome,
        descricao: dados.descricao,
        preco: dados.preco,
        duracaoMinutos: dados.duracaoMinutos,
        comissaoPercent: dados.comissaoPercent || 50,
        cor: dados.cor || '#22C55E',
        barbeariaId: barbeariaId || null,
      } as any,
    });
  }

  /** Atualiza um serviço */
  static async atualizar(id: string, dados: Partial<DadosServico & { ativo: boolean }>) {
    return prisma.servico.update({
      where: { id },
      data: dados,
    });
  }

  /** Desativa um serviço (soft delete) */
  static async desativar(id: string) {
    return prisma.servico.update({
      where: { id },
      data: { ativo: false } as any,
    });
  }
}
