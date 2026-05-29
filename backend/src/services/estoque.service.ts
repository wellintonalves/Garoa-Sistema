// Serviço de estoque — CRUD completo
import { prisma } from '../lib/prisma';

interface DadosEstoque {
  nome: string;
  quantidade: number;
  unidade: string;
  quantidadeMinima?: number;
  custo: number;
}

export class EstoqueService {
  /** Lista todos os itens do estoque */
  static async listarTodos() {
    return prisma.estoque.findMany({
      orderBy: { nome: 'asc' },
    });
  }

  /** Busca item por ID */
  static async buscarPorId(id: string) {
    const item = await prisma.estoque.findUnique({ where: { id } });
    if (!item) throw new Error('Item de estoque não encontrado');
    return item;
  }

  /** Lista itens com estoque baixo (abaixo do mínimo) */
  static async estoqueBaixo() {
    const itens = await prisma.estoque.findMany();
    return itens.filter((item: any) => item.quantidade <= item.quantidadeMinima);
  }

  /** Cria novo item no estoque */
  static async criar(dados: DadosEstoque) {
    return prisma.estoque.create({
      data: {
        nome: dados.nome,
        quantidade: dados.quantidade,
        unidade: dados.unidade,
        quantidadeMinima: dados.quantidadeMinima || 5,
        custo: dados.custo,
      } as any,
    });
  }

  /** Atualiza item do estoque */
  static async atualizar(id: string, dados: Partial<DadosEstoque>) {
    return prisma.estoque.update({
      where: { id },
      data: dados,
    });
  }

  /** Remove item do estoque */
  static async remover(id: string) {
    return prisma.estoque.delete({ where: { id } });
  }
}
