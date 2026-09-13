import { randomUUID } from "node:crypto";
import { Estoque, FormaPagamento, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { tenantStorage } from "../lib/als";
import { ErroDeNegocio } from "../lib/erros";
import { CATEGORIA_VENDA_PRODUTO, CATEGORIA_ESTORNO_PRODUTO } from "../lib/constantes";
import { inicioDiaBrasilia, fimDiaBrasilia } from "../lib/timezone";
import {
  calcularDescontoProdutos,
  DescontoProdutos,
  ratearDesconto,
} from "./descontoProdutos.service";

interface DadosEstoque {
  nome: string;
  categoria?: string | null;
  quantidade: number;
  unidade: string;
  quantidadeMinima?: number;
  custo: number;
  precoVenda?: number | null;
}
function tenant() {
  const id = tenantStorage.getStore()?.barbeariaId;
  if (!id)
    throw new ErroDeNegocio(
      "Selecione uma barbearia para acessar o estoque.",
      403,
    );
  return id;
}
function validar(d: Partial<DadosEstoque>) {
  for (const k of ["quantidade", "quantidadeMinima"] as const)
    if (d[k] !== undefined && (!Number.isSafeInteger(d[k]) || d[k]! < 0))
      throw new ErroDeNegocio(
        "Quantidades devem ser inteiras e não negativas.",
      );
  for (const k of ["custo", "precoVenda"] as const)
    if (
      d[k] != null &&
      (!Number.isFinite(d[k]) || d[k]! < 0 || d[k]! > 99999999.99)
    )
      throw new ErroDeNegocio("Informe um valor válido para custo e preço.");
  if (d.nome !== undefined && (typeof d.nome !== "string" || !d.nome.trim()))
    throw new ErroDeNegocio("Informe o nome do produto.");
  if (
    d.unidade !== undefined &&
    (typeof d.unidade !== "string" || !d.unidade.trim())
  )
    throw new ErroDeNegocio("Informe a unidade do produto.");
  if (
    d.categoria != null &&
    (typeof d.categoria !== "string" || d.categoria.length > 60)
  )
    throw new ErroDeNegocio("A categoria deve ter até 60 caracteres.");
  return {
    nome: d.nome?.trim(),
    unidade: d.unidade?.trim(),
    categoria:
      d.categoria === undefined ? undefined : d.categoria?.trim() || null,
    quantidade: d.quantidade,
    quantidadeMinima: d.quantidadeMinima,
    custo: d.custo,
    precoVenda: d.precoVenda,
  };
}
export class EstoqueService {
  /** Estorno integral: original imutável e compensações na mesma transação. */
  static async estornar(vendaId: string, motivo: string, usuarioId: string) {
    const barbeariaId = tenant();
    if (typeof motivo !== 'string' || motivo.trim().length < 5 || motivo.trim().length > 500)
      throw new ErroDeNegocio('Informe o motivo do estorno, entre 5 e 500 caracteres.');
    if (!usuarioId) throw new ErroDeNegocio('Responsável pelo estorno não identificado.', 403);
    try {
      return await prisma.$transaction(async tx => {
        const venda = await tx.vendaEstoque.findFirst({
          where: { id: vendaId, barbeariaId }, include: { itens: true, lancamento: true },
        });
        if (!venda) throw new ErroDeNegocio('Venda não encontrada nesta barbearia.', 404);
        if (venda.estornadaEm) return { vendaId, jaEstornada: true, estornadaEm: venda.estornadaEm };
        if (!venda.itens.length) throw new ErroDeNegocio('Venda sem itens auditáveis. Revise o histórico antes de estornar.');
        const original = venda.lancamento;
        if (original.tipo !== 'ENTRADA' || original.categoria !== CATEGORIA_VENDA_PRODUTO ||
            !original.valor.equals(venda.total) || original.formaPagamento !== venda.formaPagamento)
          throw new ErroDeNegocio('Esta venda possui divergência financeira. Revise o histórico antes de estornar.');
        const agora = new Date();
        const reserva = await tx.vendaEstoque.updateMany({
          where: { id: vendaId, barbeariaId, estornadaEm: null },
          data: { estornadaEm: agora, motivoEstorno: motivo.trim(), estornadoPorId: usuarioId },
        });
        if (reserva.count !== 1) throw new ErroDeNegocio('Estorno em andamento. Atualize o histórico.', 409);
        for (const item of [...venda.itens].sort((a,b) => (a.estoqueId ?? '').localeCompare(b.estoqueId ?? ''))) {
          if (!item.estoqueId || item.quantidade <= 0) throw new ErroDeNegocio('Produto sem vínculo seguro para devolver ao estoque.');
          const devolucao = await tx.estoque.updateMany({
            where: { id: item.estoqueId, barbeariaId, quantidade: { lte: 2147483647 - item.quantidade } },
            data: { quantidade: { increment: item.quantidade } },
          });
          if (devolucao.count !== 1) throw new ErroDeNegocio('Não foi possível devolver um produto ao estoque. Nenhum estorno foi aplicado.');
        }
        const lancamento = await tx.lancamentoFinanceiro.create({ data: {
          barbeariaId, tipo: 'SAIDA', categoria: CATEGORIA_ESTORNO_PRODUTO,
          descricao: `Estorno integral da venda ${vendaId}: ${motivo.trim()}`,
          valor: venda.total, formaPagamento: venda.formaPagamento,
          clienteId: original.clienteId, data: agora,
        } });
        if ((venda.pontosUtilizados ?? 0) > 0) {
          const debito = await tx.pontoFidelidade.findFirst({ where: { lancamentoId: original.id, barbeariaId } });
          if (!debito || debito.pontos !== -venda.pontosUtilizados! || debito.clienteId !== original.clienteId)
            throw new ErroDeNegocio('Débito de pontos não confere com a venda. Nenhum estorno foi aplicado.');
          const [movimentos, resgates] = await Promise.all([
            tx.pontoFidelidade.aggregate({ where: { clienteId: debito.clienteId, barbeariaId }, _sum: { pontos: true } }),
            tx.resgateRecompensa.aggregate({ where: { clienteId: debito.clienteId, barbeariaId, status: { in: ['PENDENTE', 'CONFIRMADO'] } }, _sum: { pontosUsados: true } }),
          ]);
          await tx.pontoFidelidade.create({ data: {
            barbeariaId, clienteId: debito.clienteId, lancamentoId: lancamento.id,
            tipo: 'ESTORNO', pontos: venda.pontosUtilizados!,
            saldoApos: (movimentos._sum.pontos ?? 0) - (resgates._sum.pontosUsados ?? 0) + venda.pontosUtilizados!,
            descricao: `Devolução de pontos — estorno da venda ${vendaId}`,
          } });
        }
        await tx.vendaEstoque.update({ where: { id: vendaId, barbeariaId }, data: { estornoLancamentoId: lancamento.id } });
        return { vendaId, jaEstornada: false, estornadaEm: agora };
      }, { isolationLevel: 'Serializable', timeout: 20000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code))
        throw new ErroDeNegocio('A venda ou o saldo mudou. Atualize o histórico antes de tentar novamente.', 409);
      throw error;
    }
  }
  static async simularDesconto(
    itens: { estoqueId: string; quantidade: number }[],
    desconto: DescontoProdutos,
  ) {
    const barbeariaId = tenant();
    if (!Array.isArray(itens) || !itens.length || itens.length > 100)
      throw new ErroDeNegocio("Adicione de 1 a 100 produtos à venda.");
    const quantidades = new Map<string, number>();
    for (const i of itens) {
      if (
        !i ||
        typeof i.estoqueId !== "string" ||
        !Number.isSafeInteger(i.quantidade) ||
        i.quantidade <= 0
      )
        throw new ErroDeNegocio(
          "Informe uma quantidade inteira maior que zero.",
        );
      const soma = (quantidades.get(i.estoqueId) || 0) + i.quantidade;
      if (!Number.isSafeInteger(soma) || soma > 2147483647)
        throw new ErroDeNegocio("Quantidade acima do limite.");
      quantidades.set(i.estoqueId, soma);
    }
    return prisma.$transaction(
      async (tx) => {
        const produtos = await tx.estoque.findMany({
          where: { id: { in: [...quantidades.keys()] }, barbeariaId },
        });
        if (produtos.length !== quantidades.size)
          throw new ErroDeNegocio(
            "Um dos produtos não está disponível nesta barbearia.",
          );
        let bruto = new Prisma.Decimal(0);
        for (const p of produtos) {
          if (!p.precoVenda || p.precoVenda.lte(0))
            throw new ErroDeNegocio(`Defina o preço de venda de ${p.nome}.`);
          if (p.quantidade < quantidades.get(p.id)!)
            throw new ErroDeNegocio(
              `Estoque insuficiente para ${p.nome}. Atualize o catálogo.`,
            );
          bruto = bruto.add(p.precoVenda.mul(quantidades.get(p.id)!));
        }
        if (bruto.gt(99999999.99))
          throw new ErroDeNegocio(
            "O total da venda excede o limite permitido.",
          );
        return calcularDescontoProdutos(tx, barbeariaId, bruto, desconto);
      },
      { isolationLevel: "Serializable", timeout: 20000 },
    );
  }
  static listarTodos() {
    return prisma.estoque.findMany({
      where: { barbeariaId: tenant() },
      orderBy: { nome: "asc" },
    });
  }
  static async buscarPorId(id: string) {
    const item = await prisma.estoque.findFirst({
      where: { id, barbeariaId: tenant() },
    });
    if (!item) throw new ErroDeNegocio("Produto não encontrado.", 404);
    return item;
  }
  static async estoqueBaixo() {
    return (await this.listarTodos()).filter(
      (i) => i.quantidade <= i.quantidadeMinima,
    );
  }
  static criar(dados: DadosEstoque) {
    return prisma.estoque.create({
      data: {
        ...validar(dados),
        nome: dados.nome.trim(),
        unidade: dados.unidade.trim(),
        quantidade: dados.quantidade,
        custo: dados.custo,
        barbeariaId: tenant(),
      },
    });
  }
  static async atualizar(id: string, dados: Partial<DadosEstoque>) {
    await this.buscarPorId(id);
    return prisma.estoque.update({
      where: { id, barbeariaId: tenant() },
      data: validar(dados),
    });
  }
  static async remover(id: string) {
    await this.buscarPorId(id);
    if (
      await prisma.vendaProduto.count({
        where: { estoqueId: id, barbeariaId: tenant() },
      })
    )
      throw new ErroDeNegocio(
        "Produto com histórico de vendas não pode ser excluído.",
      );
    return prisma.estoque.delete({ where: { id, barbeariaId: tenant() } });
  }
  static async valorEstoque() {
    const itens = await this.listarTodos();
    const valorCusto = itens.reduce(
      (s, i) => s + Number(i.custo) * i.quantidade,
      0,
    );
    const precificados = itens.filter(
      (i) => i.precoVenda && Number(i.precoVenda) > 0,
    );
    const valorVenda = precificados.reduce(
      (s, i) => s + Number(i.precoVenda) * i.quantidade,
      0,
    );
    return {
      valorCusto,
      valorVenda,
      lucroEstimado:
        valorVenda -
        precificados.reduce((s, i) => s + Number(i.custo) * i.quantidade, 0),
      semPreco: itens.length - precificados.length,
      totalItens: itens.length,
      alertas: itens.filter((i) => i.quantidade <= i.quantidadeMinima).length,
    };
  }
  static vender(
    estoqueId: string,
    quantidade: number,
    formaPagamento: FormaPagamento,
  ) {
    return this.venderCarrinho([{ estoqueId, quantidade }], formaPagamento);
  }
  static async venderCarrinho(
    itens: { estoqueId: string; quantidade: number }[],
    formaPagamento: FormaPagamento,
    chaveRequisicao = randomUUID(),
    desconto: DescontoProdutos = {},
  ) {
    const barbeariaId = tenant();
    if (!Array.isArray(itens) || !itens.length || itens.length > 100)
      throw new ErroDeNegocio("Adicione de 1 a 100 produtos à venda.");
    if (!Object.values(FormaPagamento).includes(formaPagamento))
      throw new ErroDeNegocio("Selecione uma forma de pagamento válida.");
    if (
      typeof chaveRequisicao !== "string" ||
      !/^[a-zA-Z0-9-]{16,80}$/.test(chaveRequisicao)
    )
      throw new ErroDeNegocio("Identificação da venda inválida.");
    const quantidades = new Map<string, number>();
    for (const i of itens) {
      if (
        !i ||
        typeof i.estoqueId !== "string" ||
        !Number.isSafeInteger(i.quantidade) ||
        i.quantidade <= 0
      )
        throw new ErroDeNegocio(
          "Informe uma quantidade inteira maior que zero.",
        );
      const soma = (quantidades.get(i.estoqueId) || 0) + i.quantidade;
      if (!Number.isSafeInteger(soma) || soma > 2147483647)
        throw new ErroDeNegocio("Quantidade acima do limite.");
      quantidades.set(i.estoqueId, soma);
    }
    try {
      return await prisma.$transaction(
        async (tx) => {
          if (
            await tx.vendaEstoque.findFirst({
              where: { barbeariaId, chaveRequisicao },
            })
          )
            throw new ErroDeNegocio(
              "Esta venda já foi registrada. Consulte o histórico antes de tentar novamente.",
              409,
            );
          const produtos: {
            item: Estoque;
            quantidade: number;
            subtotal: Prisma.Decimal;
            lucro: Prisma.Decimal;
          }[] = [];
          let total = new Prisma.Decimal(0);
          const data = new Date();
          // Ordem estável e baixa condicional protegem o estoque sob concorrência.
          for (const [id, quantidade] of [...quantidades].sort(([a], [b]) =>
            a.localeCompare(b),
          )) {
            const item = await tx.estoque.findFirst({
              where: { id, barbeariaId },
            });
            if (!item)
              throw new ErroDeNegocio(
                "Um dos produtos não está disponível nesta barbearia.",
              );
            if (!item.precoVenda || item.precoVenda.lte(0))
              throw new ErroDeNegocio(
                `Defina o preço de venda de ${item.nome}.`,
              );
            const baixa = await tx.estoque.updateMany({
              where: { id, barbeariaId, quantidade: { gte: quantidade } },
              data: { quantidade: { decrement: quantidade } },
            });
            if (baixa.count !== 1)
              throw new ErroDeNegocio(
                `Estoque insuficiente para ${item.nome}. Atualize o catálogo.`,
                409,
              );
            const subtotal = item.precoVenda.mul(quantidade);
            total = total.add(subtotal);
            produtos.push({
              item,
              quantidade,
              subtotal,
              lucro: subtotal.sub(item.custo.mul(quantidade)),
            });
          }
          if (total.gt(99999999.99))
            throw new ErroDeNegocio(
              "O total da venda excede o limite permitido.",
            );
          const calculo = await calcularDescontoProdutos(
            tx,
            barbeariaId,
            total,
            desconto,
          );
          const rateios = ratearDesconto(
            produtos.map((p) => p.subtotal),
            calculo.valorDesconto,
          );
          const lancamento = await tx.lancamentoFinanceiro.create({
            data: {
              barbeariaId,
              tipo: "ENTRADA",
              categoria: CATEGORIA_VENDA_PRODUTO,
              descricao: produtos
                .map((p) => `${p.quantidade}x ${p.item.nome}`)
                .join(", "),
              valor: calculo.valorLiquido,
              clienteId: calculo.clienteId,
              formaPagamento,
              data,
            },
          });
          const venda = await tx.vendaEstoque.create({
            data: {
              barbeariaId,
              chaveRequisicao,
              total: calculo.valorLiquido,
              valorBruto: total,
              tipoDesconto: calculo.tipoDesconto,
              valorDesconto: calculo.valorDesconto,
              descontoManual: calculo.descontoManual,
              descontoPontos: calculo.descontoPontos,
              descontoPercentual:
                calculo.tipoDesconto === "PERCENTUAL" ||
                calculo.tipoDesconto === "COMBINADO"
                  ? (desconto.descontoPercentual ?? 0)
                  : null,
              pontosUtilizados: calculo.pontosUtilizados,
              formaPagamento,
              data,
              lancamentoId: lancamento.id,
            },
          });
          if (calculo.pontosUtilizados > 0 && calculo.clienteId)
            await tx.pontoFidelidade.create({
              data: {
                barbeariaId,
                clienteId: calculo.clienteId,
                lancamentoId: lancamento.id,
                tipo: "RESGATE",
                pontos: -calculo.pontosUtilizados,
                saldoApos: calculo.saldoPontos - calculo.pontosUtilizados,
                descricao: `Resgate de pontos — venda de produtos ${venda.id} — lançamento ${lancamento.id}`,
              },
            });
          for (const [index, p] of produtos.entries())
            await tx.vendaProduto.create({
              data: {
                barbeariaId,
                vendaId: venda.id,
                estoqueId: p.item.id,
                nomeProduto: p.item.nome,
                quantidade: p.quantidade,
                precoVenda: p.item.precoVenda!,
                custoUnitario: p.item.custo,
                descontoRateado: rateios[index],
                lucro: p.lucro.sub(rateios[index]),
                formaPagamento,
                data,
              },
            });
          return {
            vendaId: venda.id,
            totalVenda: calculo.valorLiquido,
            valorBruto: total.toNumber(),
            valorDesconto: calculo.valorDesconto,
            pontosUtilizados: calculo.pontosUtilizados,
            resultados: produtos.map((p, index) => ({
              nomeProduto: p.item.nome,
              quantidade: p.quantidade,
              totalVenda: p.subtotal.sub(rateios[index]).toNumber(),
              lucro: p.lucro.sub(rateios[index]).toNumber(),
            })),
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 20000,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2034", "P2002"].includes(error.code)
      )
        throw new ErroDeNegocio(
          "O estoque mudou ou esta venda já foi registrada. Confira o histórico e atualize o catálogo.",
          409,
        );
      throw error;
    }
  }
  static async resumoVendas(inicio?: string, fim?: string) {
    const vendas = await prisma.vendaProduto.findMany({
      where: {
        barbeariaId: tenant(),
        data: {
          ...(inicio ? { gte: inicioDiaBrasilia(inicio) } : {}),
          ...(fim ? { lte: fimDiaBrasilia(fim) } : {}),
        },
      },
      orderBy: { data: "desc" },
      include: {
        venda: {
          select: {
            valorBruto: true,
            valorDesconto: true,
            tipoDesconto: true,
            descontoPercentual: true,
            pontosUtilizados: true,
            total: true,
            estornadaEm: true,
            motivoEstorno: true,
            estornadoPorId: true,
          },
        },
      },
    });
    const ativas = vendas.filter(v => !v.venda?.estornadaEm);
    const totalReceita = ativas.reduce(
      (s, v) =>
        s +
        Number(v.precoVenda) * v.quantidade -
        Number(v.descontoRateado ?? 0),
      0,
    );
    const totalCusto = ativas.reduce(
      (s, v) => s + Number(v.custoUnitario) * v.quantidade,
      0,
    );
    const porProduto: Record<
      string,
      { nome: string; unidades: number; receita: number; lucro: number }
    > = {};
    const porFormaPagamento: Record<string, number> = {};
    for (const v of ativas) {
      const p = (porProduto[v.nomeProduto] ||= {
        nome: v.nomeProduto,
        unidades: 0,
        receita: 0,
        lucro: 0,
      });
      p.unidades += v.quantidade;
      p.receita +=
        Number(v.precoVenda) * v.quantidade - Number(v.descontoRateado ?? 0);
      p.lucro += Number(v.lucro);
      porFormaPagamento[v.formaPagamento] =
        (porFormaPagamento[v.formaPagamento] || 0) +
        Number(v.precoVenda) * v.quantidade -
        Number(v.descontoRateado ?? 0);
    }
    return {
      vendas,
      totalReceita,
      totalCusto,
      totalLucro: totalReceita - totalCusto,
      totalUnidades: ativas.reduce((s, v) => s + v.quantidade, 0),
      rankingProdutos: Object.values(porProduto).sort(
        (a, b) => b.receita - a.receita,
      ),
      porFormaPagamento,
      margemLucro: totalReceita
        ? ((totalReceita - totalCusto) / totalReceita) * 100
        : 0,
    };
  }
}
