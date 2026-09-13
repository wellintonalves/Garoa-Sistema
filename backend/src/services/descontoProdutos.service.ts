import { Prisma } from "@prisma/client";
import { ErroDeNegocio } from "../lib/erros";
import { calcularFechamento } from "../utils/financeiro.util";
import { TipoDesconto } from "./desconto.service";
import { validarSaldoParaResgate } from "./saldoFidelidade.util";

export interface DescontoProdutos {
  clienteId?: string | null;
  tipoDesconto?: TipoDesconto;
  descontoReais?: number;
  descontoPercentual?: number;
  pontosUsados?: number;
}

/** Mesma função financeira e mesmos limites dos serviços; sem criar regras de acúmulo. */
export async function calcularDescontoProdutos(
  tx: Prisma.TransactionClient,
  barbeariaId: string,
  bruto: Prisma.Decimal,
  dados: DescontoProdutos,
) {
  const tipo = dados.tipoDesconto ?? "NENHUM";
  if (!["NENHUM", "REAIS", "PERCENTUAL", "PONTOS", "COMBINADO"].includes(tipo))
    throw new ErroDeNegocio("Tipo de desconto inválido.");
  const reais = dados.descontoReais ?? 0,
    percentual = dados.descontoPercentual ?? 0,
    pontos = dados.pontosUsados ?? 0;
  if (
    ![reais, percentual, pontos].every(Number.isFinite) ||
    reais < 0 ||
    percentual < 0 ||
    !Number.isSafeInteger(pontos) ||
    pontos < 0
  )
    throw new ErroDeNegocio(
      "Informe descontos válidos e pontos inteiros não negativos.",
    );
  if (dados.clienteId != null && typeof dados.clienteId !== "string")
    throw new ErroDeNegocio("Cliente inválido.");
  const cliente = dados.clienteId
    ? await tx.cliente.findFirst({
        where: {
          id: dados.clienteId,
          OR: [
            { barbeariaId },
            { clientesBarbearias: { some: { barbeariaId } } },
          ],
        },
        select: { id: true, dataNascimento: true },
      })
    : null;
  if (dados.clienteId && !cliente)
    throw new ErroDeNegocio("Cliente não pertence a esta barbearia.");
  if ((tipo === "PONTOS" || pontos > 0) && !cliente)
    throw new ErroDeNegocio("Selecione um cliente para usar pontos.");
  // Preserva a venda sem desconto mesmo quando a loja ainda não configurou a fidelidade.
  if (tipo === "NENHUM" && reais === 0 && percentual === 0 && pontos === 0)
    return {
      tipoDesconto: tipo,
      clienteId: cliente?.id ?? null,
      valorBruto: bruto.toNumber(),
      valorDesconto: 0,
      descontoManual: 0,
      descontoPontos: 0,
      pontosUtilizados: 0,
      valorLiquido: bruto.toNumber(),
      saldoPontos: 0,
    };
  const [config, global, movimentos, resgates] = await Promise.all([
    tx.configuracaoFidelidade.findUnique({ where: { barbeariaId } }),
    tx.configuracao.findUnique({ where: { barbeariaId } }),
    cliente
      ? tx.pontoFidelidade.aggregate({
          where: { clienteId: cliente.id, barbeariaId },
          _sum: { pontos: true },
        })
      : null,
    cliente
      ? tx.resgateRecompensa.aggregate({
          where: {
            clienteId: cliente.id,
            barbeariaId,
            status: { in: ["PENDENTE", "CONFIRMADO"] },
          },
          _sum: { pontosUsados: true },
        })
      : null,
  ]);
  if (!config)
    throw new ErroDeNegocio("Configuração de fidelidade não encontrada");
  if (!global) throw new ErroDeNegocio("Configuração geral não encontrada");
  const saldoPontos =
    (movimentos?._sum.pontos ?? 0) - (resgates?._sum.pontosUsados ?? 0);
  let calculo;
  try {
    calculo = calcularFechamento({
      valorBrutoOriginal: bruto.toNumber(),
      precosServicosAtuais: [bruto.toNumber()],
      servicosIds: [],
      temCliente: Boolean(cliente),
      dataNascimento: cliente?.dataNascimento,
      tipoDesconto: tipo,
      valorDescontoReais: reais,
      valorDescontoPercentual: percentual,
      pontosUsados: pontos,
      saldoPontos,
      percentualComissao: 0,
      configGlobal: {
        baseCalculoComissao: global.baseCalculoComissao,
        baseCalculoPontos: global.baseCalculoPontos,
      },
      configFidelidade: {
        ativo: config.ativo,
        regrasPorServico: config.regrasPorServico,
        pontosDobroAniversario: config.pontosDobroAniversario,
        resgatePontosAtivo: config.resgatePontosAtivo,
        valorPorPonto: Number(config.valorPorPonto),
        percentualMaxPontos: config.percentualMaxPontos,
        descontoMaxReais: Number(config.descontoMaxReais),
        descontoMaxPercentual: Number(config.descontoMaxPercentual),
        permitirCombinarDescontos: config.permitirCombinarDescontos,
        pontosPorReal: config.pontosPorReal,
        pontosPorVisita: config.pontosPorVisita,
      },
    });
  } catch (e) {
    throw new ErroDeNegocio(
      e instanceof Error
        ? e.message.replace(
            /^(Você só pode usar até \d+ pontos) para este serviço\.$/,
            "$1 nesta venda.",
          )
        : "Desconto inválido.",
    );
  }
  // A tela de serviços aplica esta validação após a mesma simulação.
  if (calculo.valorDesconto > calculo.valorBruto)
    throw new ErroDeNegocio("O desconto não pode ser maior que o valor bruto.");
  if (cliente)
    await validarSaldoParaResgate(
      tx,
      cliente.id,
      barbeariaId,
      calculo.pontosUtilizados,
    );
  return {
    ...calculo,
    tipoDesconto: tipo,
    clienteId: cliente?.id ?? null,
    saldoPontos,
  };
}

/** Rateio proporcional em centavos: resíduos vão às maiores frações, sem perder centavos. */
export function ratearDesconto(subtotais: Prisma.Decimal[], desconto: number) {
  const bruto = subtotais.reduce((s, v) => s.add(v), new Prisma.Decimal(0));
  const centavos = new Prisma.Decimal(desconto).mul(100).round();
  if (centavos.lt(0) || centavos.gt(bruto.mul(100)))
    throw new ErroDeNegocio("Desconto inválido para o total.");
  const parcelas = subtotais.map((v, index) => {
    const exato = bruto.gt(0)
      ? v.div(bruto).mul(centavos)
      : new Prisma.Decimal(0);
    return { index, centavos: exato.floor(), fracao: exato.sub(exato.floor()) };
  });
  let resto = centavos
    .sub(parcelas.reduce((s, p) => s.add(p.centavos), new Prisma.Decimal(0)))
    .toNumber();
  for (const p of [...parcelas].sort(
    (a, b) => b.fracao.comparedTo(a.fracao) || a.index - b.index,
  ))
    if (resto-- > 0) p.centavos = p.centavos.add(1);
  return parcelas.map((p) => p.centavos.div(100));
}
