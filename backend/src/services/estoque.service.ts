// Serviço de estoque — CRUD + vendas de produtos
import { prisma } from '../lib/prisma';
import { FormaPagamento } from '@prisma/client';

interface DadosEstoque {
  nome: string;
  quantidade: number;
  unidade: string;
  quantidadeMinima?: number;
  custo: number;
  precoVenda?: number | null;
}

export class EstoqueService {
  /** Lista todos os itens do estoque */
  static async listarTodos() {
    return prisma.estoque.findMany({ orderBy: { nome: 'asc' } });
  }

  /** Busca item por ID */
  static async buscarPorId(id: string) {
    const item = await prisma.estoque.findUnique({ where: { id } });
    if (!item) throw new Error('Item de estoque não encontrado');
    return item;
  }

  /** Lista itens com estoque baixo */
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
        quantidadeMinima: dados.quantidadeMinima ?? 5,
        custo: dados.custo,
        precoVenda: dados.precoVenda ?? null,
      } as any,
    });
  }

  /** Atualiza item do estoque */
  static async atualizar(id: string, dados: Partial<DadosEstoque>) {
    return prisma.estoque.update({ where: { id }, data: dados as any });
  }

  /** Remove item do estoque */
  static async remover(id: string) {
    return prisma.estoque.delete({ where: { id } });
  }

  /** KPIs de valor do estoque */
  static async valorEstoque() {
    const itens = await prisma.estoque.findMany();
    const valorCusto = itens.reduce((s: number, i: any) => s + Number(i.custo) * i.quantidade, 0);
    const valorVenda = itens.reduce((s: number, i: any) => s + (i.precoVenda ? Number(i.precoVenda) * i.quantidade : 0), 0);
    const alertas = itens.filter((i: any) => i.quantidade <= i.quantidadeMinima).length;
    return {
      valorCusto,
      valorVenda,
      lucroEstimado: valorVenda - valorCusto,
      totalItens: itens.length,
      alertas,
    };
  }

  /**
   * Registra venda de produto:
   * 1. Valida estoque disponível
   * 2. Cria registro VendaProduto
   * 3. Reduz quantidade no estoque
   * 4. Cria lançamento financeiro (ENTRADA – Venda de Produto)
   */
  static async vender(
    estoqueId: string,
    quantidade: number,
    formaPagamento: FormaPagamento,
  ) {
    const item = await prisma.estoque.findUnique({ where: { id: estoqueId } });
    if (!item) throw new Error('Produto não encontrado');
    if (!(item as any).precoVenda) throw new Error('Cadastre um preço de venda para este produto antes de vender');
    if (item.quantidade < quantidade) {
      throw new Error(`Estoque insuficiente. Disponível: ${item.quantidade} ${item.unidade}`);
    }

    const precoUnit = Number((item as any).precoVenda);
    const custoUnit = Number(item.custo);
    const totalVenda = precoUnit * quantidade;
    const totalCusto = custoUnit * quantidade;
    const lucro = totalVenda - totalCusto;

    // Registro de venda (barbeariaId injetado pelo middleware)
    const venda = await (prisma as any).vendaProduto.create({
      data: {
        estoqueId,
        nomeProduto: item.nome,
        quantidade,
        precoVenda: precoUnit,
        custoUnitario: custoUnit,
        lucro,
        formaPagamento,
        data: new Date(),
      },
    });

    // Baixa de estoque
    await prisma.estoque.update({
      where: { id: estoqueId },
      data: { quantidade: item.quantidade - quantidade },
    });

    // Lançamento financeiro automático (barbeariaId injetado pelo middleware)
    await (prisma as any).lancamentoFinanceiro.create({
      data: {
        tipo: 'ENTRADA',
        categoria: 'Venda de Produto',
        descricao: `${quantidade}x ${item.nome}`,
        valor: totalVenda,
        formaPagamento,
        data: new Date(),
      },
    });

    return { venda, totalVenda, lucro, estoqueRestante: item.quantidade - quantidade };
  }

  /**
   * Registra venda de múltiplos produtos (carrinho):
   * 1. Valida estoque de todos os itens
   * 2. Cria VendaProduto para cada item
   * 3. Reduz quantidade de cada produto
   * 4. Cria um único lançamento financeiro para o carrinho todo
   */
  static async venderCarrinho(
    itens: { estoqueId: string; quantidade: number }[],
    formaPagamento: FormaPagamento,
  ) {
    // 1. Buscar e validar todos os produtos
    const produtos = await Promise.all(
      itens.map(async ({ estoqueId, quantidade }) => {
        const item = await prisma.estoque.findUnique({ where: { id: estoqueId } });
        if (!item) throw new Error('Produto não encontrado no estoque');
        if (!(item as any).precoVenda) throw new Error(`Produto "${item.nome}" sem preço de venda`);
        if (item.quantidade < quantidade) {
          throw new Error(`Estoque insuficiente para "${item.nome}". Disponível: ${item.quantidade} ${item.unidade}`);
        }
        return { item, quantidade };
      }),
    );

    let totalVendaGeral = 0;
    const resultados: { nomeProduto: string; quantidade: number; totalVenda: number; lucro: number }[] = [];

    // 2 & 3. Criar vendas e dar baixa no estoque
    for (const { item, quantidade } of produtos) {
      const precoUnit = Number((item as any).precoVenda);
      const custoUnit = Number(item.custo);
      const totalVenda = precoUnit * quantidade;
      const lucro = totalVenda - custoUnit * quantidade;
      totalVendaGeral += totalVenda;

      await (prisma as any).vendaProduto.create({
        data: {
          estoqueId: item.id,
          nomeProduto: item.nome,
          quantidade,
          precoVenda: precoUnit,
          custoUnitario: custoUnit,
          lucro,
          formaPagamento,
          data: new Date(),
        },
      });

      await prisma.estoque.update({
        where: { id: item.id },
        data: { quantidade: item.quantidade - quantidade },
      });

      resultados.push({ nomeProduto: item.nome, quantidade, totalVenda, lucro });
    }

    // 4. Lançamento financeiro único para o carrinho inteiro
    const descricao = produtos
      .map(p => `${p.quantidade}x ${p.item.nome}`)
      .join(', ');

    await (prisma as any).lancamentoFinanceiro.create({
      data: {
        tipo: 'ENTRADA',
        categoria: 'Venda de Produto',
        descricao,
        valor: totalVendaGeral,
        formaPagamento,
        data: new Date(),
      },
    });

    return { resultados, totalVenda: totalVendaGeral };
  }

  /** Histórico e resumo de vendas de produtos */
  static async resumoVendas(inicio?: string, fim?: string) {
    const where: any = {};
    if (inicio || fim) {
      where.data = {};
      if (inicio) where.data.gte = new Date(inicio);
      if (fim) {
        const d = new Date(fim);
        d.setDate(d.getDate() + 1);
        where.data.lt = d;
      }
    }

    const vendas = await (prisma as any).vendaProduto.findMany({
      where,
      orderBy: { data: 'desc' },
    });

    const totalReceita = vendas.reduce((s: number, v: any) => s + Number(v.precoVenda) * v.quantidade, 0);
    const totalCusto = vendas.reduce((s: number, v: any) => s + Number(v.custoUnitario) * v.quantidade, 0);
    const totalLucro = totalReceita - totalCusto;
    const totalUnidades = vendas.reduce((s: number, v: any) => s + v.quantidade, 0);

    // Ranking de produtos mais vendidos
    const porProduto: Record<string, { nome: string; unidades: number; receita: number; lucro: number }> = {};
    for (const v of vendas) {
      const key = v.nomeProduto;
      if (!porProduto[key]) porProduto[key] = { nome: key, unidades: 0, receita: 0, lucro: 0 };
      porProduto[key].unidades += v.quantidade;
      porProduto[key].receita += Number(v.precoVenda) * v.quantidade;
      porProduto[key].lucro += Number(v.lucro);
    }
    const rankingProdutos = Object.values(porProduto).sort((a, b) => b.receita - a.receita);

    return { vendas, totalReceita, totalCusto, totalLucro, totalUnidades, rankingProdutos };
  }
}
