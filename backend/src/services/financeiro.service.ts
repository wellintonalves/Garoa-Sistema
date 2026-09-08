// Serviço financeiro — CRUD + resumos
import { prisma } from '../lib/prisma';
import { TipoLancamento, FormaPagamento, BaseCalculoComissao, Prisma } from '@prisma/client';
import { calcularComissao } from '../utils/comissao.util';
import { inicioDiaBrasilia, fimDiaBrasilia, diaBrasiliaStr, getHoraMinutoBrasilia } from '../lib/timezone';
import { CATEGORIA_VENDA_PRODUTO } from '../lib/constantes';
import { obterIdsServicosAgendamento } from '../utils/agendamento.util';
import { prepararOperacoesFidelidadeLancamento } from './fidelidade.engine';
import { tenantStorage } from '../lib/als';
import { ErroDeNegocio } from '../lib/erros';
import { validarSaldoParaResgate, tratarConflitoDeFechamento } from './saldoFidelidade.util';

interface DadosLancamento {
  tipo: TipoLancamento;
  categoria: string;
  descricao?: string;
  valor: number;
  formaPagamento: FormaPagamento;
  agendamentoId?: string;
  clienteId?: string;
  barbeiroId?: string;
  servicoId?: string;
  data: string;
  itens?: { servicoId: string; preco?: number }[];
  servicosIds?: string[];
  tipoDesconto?: 'NENHUM' | 'REAIS' | 'PERCENTUAL' | 'PONTOS' | 'COMBINADO';
  descontoReais?: number;
  descontoPercentual?: number;
  pontosUsados?: number;
}

export class FinanceiroService {
  /** Lista lançamentos com filtros */
  static async listarTodos(filtros?: { inicio?: string; fim?: string; tipo?: TipoLancamento }) {
    const where: Record<string, unknown> = {};

    if (filtros?.tipo) where.tipo = filtros.tipo;
    if (filtros?.inicio || filtros?.fim) {
      where.data = {};
      if (filtros.inicio) (where.data as Record<string, Date>).gte = inicioDiaBrasilia(filtros.inicio);
      if (filtros.fim) (where.data as Record<string, Date>).lte = fimDiaBrasilia(filtros.fim);
    }

    return prisma.lancamentoFinanceiro.findMany({
      where,
      include: { 
        agendamento: { select: { id: true } },
        barbeiro: { include: { usuario: { select: { nome: true } } } },
        servico: { select: { nome: true } },
        itens: { orderBy: { ordem: 'asc' } }
      },
      orderBy: { data: 'desc' },
    });
  }

  /** POST /financeiro/simular-desconto */
  static async simularDesconto(dados: any) {
    const store = tenantStorage.getStore();
    const barbeariaId = store?.barbeariaId;
    if (!barbeariaId) throw new Error('Contexto de barbearia não encontrado');

    const [configFidelidade, configGlobal, barbeiro, agregacaoPontos, agregacaoResgates] = await Promise.all([
      prisma.configuracaoFidelidade.findUnique({ where: { barbeariaId } }),
      prisma.configuracao.findUnique({ where: { barbeariaId } }),
      dados.barbeiroId ? prisma.barbeiro.findUnique({ where: { id: dados.barbeiroId }, select: { comissaoPercent: true } }) : null,
      dados.clienteId ? prisma.pontoFidelidade.aggregate({ where: { clienteId: dados.clienteId, barbeariaId }, _sum: { pontos: true } }) : null,
      dados.clienteId ? prisma.resgateRecompensa.aggregate({ where: { clienteId: dados.clienteId, barbeariaId, status: { in: ['PENDENTE', 'CONFIRMADO'] } }, _sum: { pontosUsados: true } }) : null
    ]);

    if (!configFidelidade) throw new Error('Configuração de fidelidade não encontrada');
    if (!configGlobal) throw new Error('Configuração geral não encontrada');

    const cliente = dados.clienteId ? await prisma.cliente.findFirst({
      where: { id: dados.clienteId, OR: [
        { barbeariaId }, { clientesBarbearias: { some: { barbeariaId } } },
      ] }, select: { dataNascimento: true },
    }) : null;
    if (dados.clienteId && !cliente) throw new ErroDeNegocio('Cliente não pertence a esta barbearia.');

    const totalGanho = agregacaoPontos?._sum?.pontos || 0;
    const totalGasto = agregacaoResgates?._sum?.pontosUsados || 0;
    const saldoPontos = totalGanho - totalGasto;

    let precosServicosAtuais: number[] = [];
    if (dados.itens && dados.itens.length > 0) {
      const ids = dados.itens.map((i: any) => i.servicoId).filter(Boolean);
      const servicos = await prisma.servico.findMany({ where: { id: { in: ids } } });
      if (servicos.length !== ids.length) {
        throw new ErroDeNegocio('Um ou mais serviços informados não foram encontrados no catálogo.');
      }
      precosServicosAtuais = servicos.map(s => Number(s.preco));
    } else if (dados.servicosIds && dados.servicosIds.length > 0) {
      const servicos = await prisma.servico.findMany({ where: { id: { in: dados.servicosIds } } });
      precosServicosAtuais = servicos.map(s => Number(s.preco));
    } else if (dados.servicoId) {
      const servico = await prisma.servico.findUnique({ where: { id: dados.servicoId } });
      if (servico) precosServicosAtuais.push(Number(servico.preco));
    } else if (dados.valor) {
      precosServicosAtuais = [Number(dados.valor)];
    }
    
    const valorBrutoOriginal = precosServicosAtuais.reduce((a, b) => a + b, 0);

    const { calcularFechamento } = await import('../utils/financeiro.util');
    
    const resultado = calcularFechamento({
      servicosIds: obterIdsServicosAgendamento(dados),
      temCliente: Boolean(cliente),
      dataNascimento: cliente?.dataNascimento,
      valorBrutoOriginal,
      precosServicosAtuais,
      tipoDesconto: dados.tipoDesconto || 'NENHUM',
      valorDescontoReais: Number(dados.descontoReais || 0),
      valorDescontoPercentual: Number(dados.descontoPercentual || 0),
      pontosUsados: Number(dados.pontosUsados || 0),
      saldoPontos,
      configFidelidade: {
        ativo: configFidelidade.ativo,
        regrasPorServico: configFidelidade.regrasPorServico,
        pontosDobroAniversario: configFidelidade.pontosDobroAniversario,
        resgatePontosAtivo: configFidelidade.resgatePontosAtivo ?? false,
        valorPorPonto: Number(configFidelidade.valorPorPonto),
        percentualMaxPontos: Number(configFidelidade.percentualMaxPontos),
        descontoMaxReais: Number(configFidelidade.descontoMaxReais),
        descontoMaxPercentual: Number(configFidelidade.descontoMaxPercentual),
        permitirCombinarDescontos: configFidelidade.permitirCombinarDescontos ?? false,
        pontosPorReal: Number(configFidelidade.pontosPorReal || 0),
        pontosPorVisita: Number(configFidelidade.pontosPorVisita || 0)
      },
      configGlobal: {
        baseCalculoComissao: configGlobal.baseCalculoComissao,
        baseCalculoPontos: configGlobal.baseCalculoPontos
      },
      percentualComissao: barbeiro ? (barbeiro.comissaoPercent ?? 0) : 0
    });
    return { ...resultado,
      baseAcumulo: configGlobal.baseCalculoPontos === 'VALOR_BRUTO' ? resultado.valorBruto : resultado.valorLiquido,
      percentualComissao: barbeiro?.comissaoPercent ?? 0,
      baseComissaoAplicada: configGlobal.baseCalculoComissao,
    };
  }

  /** Cria um lançamento */
  static async criar(dados: DadosLancamento) {
    if (!Number.isFinite(Number(dados.valor)) || Number(dados.valor) < 0) throw new ErroDeNegocio('Valor inválido.');
    let valorComissao: number | null = null;
    let valorLiquido: number | null = null;
    let percentualAplicado: number | null = null;
    let baseAplicada: BaseCalculoComissao | null = null;
    let valorFinal = Number(dados.valor || 0);

    let descontoInfo: any = null;

    // Se for serviço prestado e tiver barbeiro vinculado
    if (dados.tipo === 'ENTRADA' && dados.categoria !== CATEGORIA_VENDA_PRODUTO && (dados.tipoDesconto || dados.itens?.length || dados.servicosIds?.length || dados.servicoId)) {
      descontoInfo = await FinanceiroService.simularDesconto(dados);
      valorFinal = descontoInfo.valorLiquido;
      valorComissao = descontoInfo.valorComissao;
      valorLiquido = valorFinal - (valorComissao || 0);
    } else if (dados.tipo === 'ENTRADA' && dados.categoria !== CATEGORIA_VENDA_PRODUTO && dados.barbeiroId) {
      const barbeariaId = tenantStorage.getStore()?.barbeariaId;
      if (!barbeariaId) throw new ErroDeNegocio('Contexto de barbearia não encontrado.');
      const barbeiro = await prisma.barbeiro.findFirst({
        where: { id: dados.barbeiroId, barbeariaId },
        select: { comissaoPercent: true }
      });
      if (!barbeiro) throw new ErroDeNegocio('Barbeiro não encontrado nesta barbearia.');
      const config = await prisma.configuracao.findUnique({ where: { barbeariaId } });
      percentualAplicado = barbeiro.comissaoPercent ?? 0;
      baseAplicada = config?.baseCalculoComissao ?? 'VALOR_LIQUIDO';
      valorComissao = calcularComissao(valorFinal, percentualAplicado);
      valorLiquido = Math.round((valorFinal - valorComissao) * 100) / 100;
    }

    const payloadLancamento = {
      tipo: dados.tipo,
      categoria: dados.categoria,
      descricao: dados.descricao,
      valor: valorFinal,
      formaPagamento: dados.formaPagamento,
      agendamentoId: dados.agendamentoId || null,
      clienteId: dados.clienteId || null,
      barbeiroId: dados.barbeiroId || null,
      servicoId: dados.servicoId || null,
      valorComissao,
      valorLiquido,
      percentualComissao: descontoInfo?.percentualComissao ?? percentualAplicado,
      baseComissaoAplicada: descontoInfo?.baseComissaoAplicada ?? baseAplicada,
      data: inicioDiaBrasilia(dados.data),
    };

    const store = tenantStorage.getStore();
    const barbeariaId = store?.barbeariaId;

    if (dados.itens && dados.itens.length > 0) {
      const servicosAtuais = await prisma.servico.findMany({ where: { id: { in: dados.itens.map((i: any) => i.servicoId) } } });
      const mapServicos = new Map(servicosAtuais.map((s: any) => [s.id, s]));
      
      (payloadLancamento as any).itens = {
        create: dados.itens.map((item: any, idx: number) => {
          const s = mapServicos.get(item.servicoId);
          if (!s) {
            throw new ErroDeNegocio(`Serviço não encontrado: ${item.servicoId}`);
          }
          return {
            servicoId: item.servicoId,
            nome: s.nome,
            preco: Number(s.preco),
            duracaoMinutos: s.duracaoMinutos,
            barbeariaId: barbeariaId,
            ordem: idx
          };
        })
      };
    } else if (dados.servicosIds && dados.servicosIds.length > 0) {
      const servicosAtuais = await prisma.servico.findMany({ where: { id: { in: dados.servicosIds } } });
      (payloadLancamento as any).itens = {
        create: servicosAtuais.map((s: any, idx: number) => ({
          servicoId: s.id,
          nome: s.nome,
          preco: Number(s.preco),
          duracaoMinutos: s.duracaoMinutos,
          barbeariaId: barbeariaId,
          ordem: idx
        }))
      };
    } else if (dados.servicoId) {
      const s = await prisma.servico.findUnique({ where: { id: dados.servicoId } });
      if (s) {
        (payloadLancamento as any).itens = {
          create: [{
            servicoId: s.id,
            nome: s.nome,
            preco: Number(s.preco),
            duracaoMinutos: s.duracaoMinutos,
            barbeariaId: barbeariaId,
            ordem: 0
          }]
        };
      }
    }

    if (dados.clienteId && barbeariaId) {
      const cliente = await prisma.cliente.findUnique({ where: { id: dados.clienteId } });
      if (!cliente) throw new Error('Cliente não encontrado');

      const vinculadoDiretamente = cliente.barbeariaId === barbeariaId;
      const vinculoJunction = await prisma.clienteBarbearia.findUnique({
        where: { clienteId_barbeariaId: { clienteId: dados.clienteId, barbeariaId } }
      });

      if (!vinculadoDiretamente && !vinculoJunction) {
        throw new Error('Cliente não pertence a esta barbearia');
      }
    }

    // Se houver cliente vinculado a uma entrada avulsa, pontua na mesma transação
    if (dados.tipo === 'ENTRADA' && dados.clienteId && !dados.agendamentoId && barbeariaId) {
      // 'temp' será substituído pelo ID real dentro da transação
      const ops = await prepararOperacoesFidelidadeLancamento(
        'temp',
        dados.clienteId,
        barbeariaId,
        obterIdsServicosAgendamento(dados),
        descontoInfo?.baseAcumulo ?? valorFinal
      );

      if (descontoInfo?.pontosUtilizados > 0) {
        ops.pontosParaCriar.push({
          clienteId: dados.clienteId,
          barbeariaId,
          pontos: -descontoInfo.pontosUtilizados,
          descricao: `Resgate de pontos - Lançamento manual`
        });
      }

      return prisma.$transaction(async (tx) => {
        await validarSaldoParaResgate(tx, dados.clienteId!, barbeariaId, descontoInfo?.pontosUtilizados ?? 0);
        const lancamento = await tx.lancamentoFinanceiro.create({
          data: payloadLancamento as any,
        });

        if (ops.pontosParaCriar.length > 0) {
          for (const op of ops.pontosParaCriar) {
            await tx.pontoFidelidade.create({
              data: {
                clienteId: op.clienteId,
                barbeariaId: op.barbeariaId,
                // O vínculo único pertence ao crédito; o débito mantém a referência no extrato.
                lancamentoId: op.lancamentoId ? lancamento.id : undefined,
                pontos: op.pontos,
                descricao: op.lancamentoId ? op.descricao : `${op.descricao} — lançamento ${lancamento.id}`
              }
            });
          }
        }
        return lancamento;
      }, { isolationLevel: 'Serializable' }).catch(tratarConflitoDeFechamento);
    }

    return prisma.lancamentoFinanceiro.create({
      data: payloadLancamento as any,
    });
  }

  /** Atualiza um lançamento */
  static async atualizar(id: string, dados: Partial<DadosLancamento>, isAdmin: boolean = false) {
    const barbeariaId = tenantStorage.getStore()?.barbeariaId;
    if (!barbeariaId) throw new ErroDeNegocio('Contexto de barbearia não encontrado.');
    // Campos derivados, relações aninhadas e IDs de tenant nunca vêm da requisição.
    const permitidos: Partial<Pick<DadosLancamento, 'tipo' | 'categoria' | 'descricao' | 'valor' | 'formaPagamento' | 'data' | 'barbeiroId' | 'clienteId' | 'servicoId'>> = {};
    const campos = ['tipo', 'categoria', 'descricao', 'valor', 'formaPagamento', 'data', 'barbeiroId', 'clienteId', 'servicoId'] as const;
    for (const campo of campos) {
      if (dados[campo] !== undefined) Object.assign(permitidos, { [campo]: dados[campo] });
    }
    if (permitidos.valor !== undefined && (typeof permitidos.valor !== 'number' || !Number.isFinite(permitidos.valor) || permitidos.valor < 0)) {
      throw new ErroDeNegocio('Valor inválido.');
    }
    return prisma.$transaction(async tx => {
    const lancamento = await tx.lancamentoFinanceiro.findFirst({ where: { id, barbeariaId }, include: { itens: true, agendamento: true } });
    if (!lancamento) throw new ErroDeNegocio('Lançamento não encontrado.');

    if (lancamento.barbeiroId && !isAdmin) {
      const aprovacao = await tx.aprovacaoEdicao.create({
        data: {
          lancamentoId: id,
          barbeiroId: lancamento.barbeiroId,
          acao: 'EDITAR',
          dadosNovos: JSON.parse(JSON.stringify(permitidos)),
        }
      });
      return { status: 'PENDENTE', aprovacao };
    }

    const data: Prisma.LancamentoFinanceiroUncheckedUpdateInput = {
      ...permitidos, data: permitidos.data ? inicioDiaBrasilia(permitidos.data) : undefined,
      barbeiroId: permitidos.barbeiroId === '' ? null : permitidos.barbeiroId,
      clienteId: permitidos.clienteId === '' ? null : permitidos.clienteId,
      servicoId: permitidos.servicoId === '' ? null : permitidos.servicoId,
    };
    const barbeiroId = permitidos.barbeiroId !== undefined ? permitidos.barbeiroId || null : lancamento.barbeiroId;
    if (barbeiroId && barbeiroId !== lancamento.barbeiroId && !await tx.barbeiro.findFirst({ where: { id: barbeiroId, barbeariaId } })) {
      throw new ErroDeNegocio('Barbeiro não pertence a esta barbearia.');
    }
    const clienteId = permitidos.clienteId !== undefined ? permitidos.clienteId || null : lancamento.clienteId;
    if (clienteId && clienteId !== lancamento.clienteId) {
      const cliente = await tx.cliente.findFirst({ where: { id: clienteId, OR: [{ barbeariaId }, { clientesBarbearias: { some: { barbeariaId } } }] } });
      if (!cliente) throw new ErroDeNegocio('Cliente não pertence a esta barbearia.');
    }
    if (permitidos.servicoId && permitidos.servicoId !== lancamento.servicoId && !await tx.servico.findFirst({ where: { id: permitidos.servicoId, barbeariaId } })) {
      throw new ErroDeNegocio('Serviço não pertence a esta barbearia.');
    }
    const valor = permitidos.valor ?? Number(lancamento.valor);
    const tipo = permitidos.tipo ?? lancamento.tipo;
    const categoria = permitidos.categoria ?? lancamento.categoria;
    const alterouCalculo = valor !== Number(lancamento.valor) || barbeiroId !== lancamento.barbeiroId || tipo !== lancamento.tipo || categoria !== lancamento.categoria;
    if (alterouCalculo) {
      if (tipo !== 'ENTRADA' || categoria === CATEGORIA_VENDA_PRODUTO || !barbeiroId) {
        Object.assign(data, { valorComissao: 0, valorLiquido: valor, percentualComissao: 0, baseComissaoAplicada: null });
      } else {
        const barbeiro = await tx.barbeiro.findFirst({ where: { id: barbeiroId, barbeariaId } });
        if (!barbeiro) throw new ErroDeNegocio('Barbeiro não encontrado nesta barbearia.');
        const config = await tx.configuracao.findUnique({ where: { barbeariaId } });
        const mesmoBarbeiro = barbeiroId === lancamento.barbeiroId && lancamento.tipo === 'ENTRADA' && lancamento.categoria !== CATEGORIA_VENDA_PRODUTO;
        const percentual = mesmoBarbeiro && lancamento.percentualComissao != null ? Number(lancamento.percentualComissao) : barbeiro.comissaoPercent ?? 0;
        const base = lancamento.baseComissaoAplicada ?? config?.baseCalculoComissao ?? 'VALOR_LIQUIDO';
        let valorBase = valor;
        if (base === 'VALOR_BRUTO') {
          if (lancamento.agendamento?.valorBruto != null) valorBase = Number(lancamento.agendamento.valorBruto);
          else if (lancamento.itens.length) valorBase = lancamento.itens.reduce((total, item) => total + Number(item.preco), 0);
          else if (lancamento.baseComissaoAplicada === 'VALOR_BRUTO' && lancamento.percentualComissao != null &&
            Math.abs(calcularComissao(Number(lancamento.valor), Number(lancamento.percentualComissao)) - Number(lancamento.valorComissao)) > 0.01) {
            throw new ErroDeNegocio('Não há valor bruto preservado para recalcular este lançamento com segurança.');
          }
        }
        const comissao = calcularComissao(valorBase, percentual);
        Object.assign(data, { valorComissao: comissao, valorLiquido: Math.round((valor - comissao) * 100) / 100, percentualComissao: percentual, baseComissaoAplicada: base });
      }
    }
    return tx.lancamentoFinanceiro.update({ where: { id, barbeariaId }, data });
    }, { isolationLevel: 'Serializable' }).catch(tratarConflitoDeFechamento);
  }

  /** Adiciona um lançamento extra vinculado a uma aprovação de edição */
  static async adicionarPendente(lancamentoIdReferencia: string, dados: DadosLancamento) {
    const lancamento = await prisma.lancamentoFinanceiro.findUnique({ where: { id: lancamentoIdReferencia } });
    if (!lancamento) throw new Error('Lançamento não encontrado.');

    if (dados.barbeiroId) {
      const aprovacao = await prisma.aprovacaoEdicao.create({
        data: {
          lancamentoId: lancamentoIdReferencia,
          barbeiroId: dados.barbeiroId,
          acao: 'ADICIONAR',
          dadosNovos: JSON.parse(JSON.stringify(dados)),
        }
      });
      return { status: 'PENDENTE', aprovacao };
    }

    // Se não tiver barbeiro, cria direto
    return FinanceiroService.criar(dados);
  }

  /** Remove um lançamento */
  static async remover(id: string, isAdmin: boolean = false) {
    const lancamento = await prisma.lancamentoFinanceiro.findUnique({ where: { id } });
    if (!lancamento) throw new Error('Lançamento não encontrado.');

    if (lancamento.barbeiroId && !isAdmin) {
      const aprovacao = await prisma.aprovacaoEdicao.create({
        data: {
          lancamentoId: id,
          barbeiroId: lancamento.barbeiroId,
          acao: 'EXCLUIR',
        }
      });
      return { status: 'PENDENTE', aprovacao };
    }

    return prisma.lancamentoFinanceiro.delete({ where: { id } });
  }

  /** Resumo do dia — total por forma de pagamento */
  static async resumoDoDia(data: string) {
    const inicio = inicioDiaBrasilia(data);
    const fim = fimDiaBrasilia(data);

    const lancamentos = await prisma.lancamentoFinanceiro.findMany({
      where: { data: { gte: inicio, lte: fim } } as any,
    });

    const porFormaPagamento: Record<string, number> = {};
    let totalEntradas = 0;
    let entradasServicos = 0;
    let entradasProdutos = 0;
    let totalSaidas = 0;

    lancamentos.forEach((l: any) => {
      const valor = Number(l.valor);
      const forma = l.formaPagamento;

      if (!porFormaPagamento[forma]) porFormaPagamento[forma] = 0;

      if (l.tipo === 'ENTRADA') {
        if (l.categoria === CATEGORIA_VENDA_PRODUTO) {
          entradasProdutos += valor;
        } else {
          entradasServicos += valor;
        }
        totalEntradas += valor;
        porFormaPagamento[forma] += valor;
      } else {
        totalSaidas += valor;
        porFormaPagamento[forma] -= valor;
      }
    });

    return {
      data,
      totalEntradas,
      entradasServicos,
      entradasProdutos,
      totalSaidas,
      saldo: totalEntradas - totalSaidas,
      porFormaPagamento,
      totalLancamentos: lancamentos.length,
    };
  }

  /** Resumo dos últimos 7 dias (para gráfico) */
  static async ultimos7Dias() {
    const resultado: Array<{ data: string; entradas: number; entradasServicos: number; entradasProdutos: number; saidas: number }> = [];

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const inicioFiltro = new Date(hoje);
    inicioFiltro.setDate(inicioFiltro.getDate() - 6);
    
    // Converte para as strings que a lib de timezone espera
    const inicioStr = inicioFiltro.toISOString().split('T')[0];
    const fimStr = hoje.toISOString().split('T')[0];

    const dataInicio = inicioDiaBrasilia(inicioStr);
    const dataFim = fimDiaBrasilia(fimStr);

    const lancamentos = await prisma.lancamentoFinanceiro.findMany({
      where: { data: { gte: dataInicio, lte: dataFim } } as any,
    });

    const agrupado: Record<string, { entradas: number; entradasServicos: number; entradasProdutos: number; saidas: number }> = {};

    lancamentos.forEach((l: any) => {
      // Cria a chave YYYY-MM-DD usando a data do banco no fuso de Brasília
      const diaKey = diaBrasiliaStr(new Date(l.data));
      if (!agrupado[diaKey]) {
        agrupado[diaKey] = { entradas: 0, entradasServicos: 0, entradasProdutos: 0, saidas: 0 };
      }

      const valor = Number(l.valor);
      if (l.tipo === 'ENTRADA') {
        agrupado[diaKey].entradas += valor;
        if (l.categoria === CATEGORIA_VENDA_PRODUTO) {
          agrupado[diaKey].entradasProdutos += valor;
        } else {
          agrupado[diaKey].entradasServicos += valor;
        }
      } else {
        agrupado[diaKey].saidas += valor;
      }
    });

    for (let i = 6; i >= 0; i--) {
      const dia = new Date();
      dia.setDate(dia.getDate() - i);
      const diaStr = diaBrasiliaStr(dia);

      resultado.push({
        data: diaStr,
        entradas: agrupado[diaStr]?.entradas || 0,
        entradasServicos: agrupado[diaStr]?.entradasServicos || 0,
        entradasProdutos: agrupado[diaStr]?.entradasProdutos || 0,
        saidas: agrupado[diaStr]?.saidas || 0,
      });
    }

    return resultado;
  }

  /** Relatório detalhado financeiro */
  static async relatorio(filtros: { inicio: string; fim: string; barbeiroId?: string }) {
    const where: any = {};
    
    if (filtros.inicio || filtros.fim) {
      where.data = {};
      if (filtros.inicio) where.data.gte = inicioDiaBrasilia(filtros.inicio);
      if (filtros.fim) where.data.lte = fimDiaBrasilia(filtros.fim);
    }

    if (filtros.barbeiroId && filtros.barbeiroId !== 'todos') {
      where.barbeiroId = filtros.barbeiroId;
    }

    const lancamentos = await prisma.lancamentoFinanceiro.findMany({
      where,
      include: {
        barbeiro: { include: { usuario: { select: { nome: true } } } },
        servico: { select: { nome: true } },
        agendamento: { select: { valorBruto: true } },
        itens: { orderBy: { ordem: 'asc' } }
      },
      orderBy: { data: 'desc' }
    });

    const consolidado = {
      totalBruto: 0,
      totalProdutos: 0,
      totalComissoes: 0,
      totalLiquido: 0,
      totalAtendimentos: 0,
      porBarbeiro: {} as Record<string, { nome: string; bruto: number; comissao: number; liquido: number; percentualAplicado: number | null; lancamentosDivergentes: number; lancamentosSemBaseAuditavel: number }>
    };

    lancamentos.forEach((l: any) => {
      const valor = Number(l.valor);
      
      if (l.tipo === 'ENTRADA') {
        if (l.categoria === CATEGORIA_VENDA_PRODUTO) {
          consolidado.totalProdutos += valor;
        } else {
          consolidado.totalBruto += valor;
          
          if (l.barbeiroId && l.barbeiro) {
            const nomeBarbeiro = l.barbeiro.usuario.nome;
            const comissao = Number(l.valorComissao) || 0;
            const liquido = l.valorLiquido != null ? Number(l.valorLiquido) : valor - comissao;
            
            consolidado.totalComissoes += comissao;
            consolidado.totalLiquido += liquido;
            consolidado.totalAtendimentos++;

            if (!consolidado.porBarbeiro[l.barbeiroId]) {
              consolidado.porBarbeiro[l.barbeiroId] = { nome: nomeBarbeiro, bruto: 0, comissao: 0, liquido: 0,
                percentualAplicado: l.percentualComissao != null ? Number(l.percentualComissao) : null,
                lancamentosDivergentes: 0, lancamentosSemBaseAuditavel: 0 };
            }
            const resumoBarbeiro = consolidado.porBarbeiro[l.barbeiroId];
            const percentual = l.percentualComissao != null ? Number(l.percentualComissao) : null;
            if (resumoBarbeiro.percentualAplicado !== percentual) resumoBarbeiro.percentualAplicado = null;
            // Sem percentual/base histórica, não use a configuração atual para acusar erro antigo.
            const baseAuditavel = l.baseComissaoAplicada === 'VALOR_LIQUIDO' ? valor
              : l.baseComissaoAplicada === 'VALOR_BRUTO' ? (l.agendamento?.valorBruto != null ? Number(l.agendamento.valorBruto)
                : l.itens?.length ? l.itens.reduce((total: number, item: { preco: unknown }) => total + Number(item.preco), 0) : null) : null;
            if (percentual == null || baseAuditavel == null) resumoBarbeiro.lancamentosSemBaseAuditavel++;
            else if (percentual < 0 || percentual > 100 || baseAuditavel < 0 || Math.abs(Math.round(comissao * 100) - Math.round(calcularComissao(baseAuditavel, percentual) * 100)) > 1) resumoBarbeiro.lancamentosDivergentes++;
            consolidado.porBarbeiro[l.barbeiroId].bruto += valor;
            consolidado.porBarbeiro[l.barbeiroId].comissao += comissao;
            consolidado.porBarbeiro[l.barbeiroId].liquido += liquido;
          } else {
            // Entradas sem barbeiro (ex: outros serviços) vão pro líquido integral
            consolidado.totalLiquido += valor;
          }
        }
      }
    });

    return { consolidado, lancamentos };
  }

  /** Resumo para o Dashboard — aceita período customizável e comparação contextual */
  static async dashboardResumo(inicio: string, fim: string, periodo?: string) {
    const dataInicio = inicioDiaBrasilia(inicio);
    let dataFim = fimDiaBrasilia(fim);

    const agora = new Date();
    const hojeStr = diaBrasiliaStr(agora);
    const isFimHoje = fim === hojeStr || dataFim > agora;
    if (isFimHoje && inicio === hojeStr) {
      dataFim = agora;
    }

    let periodoCalc = periodo || 'custom';
    if (!periodo || periodo === 'custom' || periodo === 'undefined') {
      const diffDaysCalc = Math.round((fimDiaBrasilia(fim).getTime() - dataInicio.getTime()) / (1000 * 60 * 60 * 24));
      if (inicio === hojeStr && fim === hojeStr) periodoCalc = 'hoje';
      else if (diffDaysCalc === 0) periodoCalc = 'ontem';
      else if (diffDaysCalc === 6) periodoCalc = 'semana';
      else if (inicio.endsWith('-01')) periodoCalc = 'mes';
    }

    let dataInicioAnterior: Date;
    let dataFimAnterior: Date;

    if (periodoCalc === 'hoje' || (inicio === hojeStr && fim === hojeStr)) {
      dataInicioAnterior = new Date(dataInicio.getTime() - 24 * 60 * 60 * 1000);
      dataFimAnterior = new Date(dataFim.getTime() - 24 * 60 * 60 * 1000);
    } else if (periodoCalc === 'ontem') {
      dataInicioAnterior = new Date(dataInicio.getTime() - 24 * 60 * 60 * 1000);
      dataFimAnterior = new Date(fimDiaBrasilia(fim).getTime() - 24 * 60 * 60 * 1000);
    } else if (periodoCalc === 'semana' || periodoCalc === 'esta_semana' || periodoCalc === '7dias') {
      const duracao = 7 * 24 * 60 * 60 * 1000;
      dataInicioAnterior = new Date(dataInicio.getTime() - duracao);
      dataFimAnterior = new Date(dataFim.getTime() - duracao);
    } else if (periodoCalc === 'mes' || periodoCalc === 'este_mes' || periodoCalc === 'mes_anterior' || periodoCalc === '30dias') {
      const dIniAnt = new Date(dataInicio);
      dIniAnt.setMonth(dIniAnt.getMonth() - 1);
      dataInicioAnterior = dIniAnt;

      const dFimAnt = new Date(dataFim);
      const targetMonth = dFimAnt.getMonth() - 1;
      dFimAnt.setDate(1);
      dFimAnt.setMonth(targetMonth);
      const maxDays = new Date(dFimAnt.getFullYear(), dFimAnt.getMonth() + 1, 0).getDate();
      dFimAnt.setDate(Math.min(dataFim.getDate(), maxDays));
      dataFimAnterior = dFimAnt;
    } else if (periodoCalc === 'ano' || periodoCalc === 'este_ano') {
      const dIniAnt = new Date(dataInicio);
      dIniAnt.setFullYear(dIniAnt.getFullYear() - 1);
      dataInicioAnterior = dIniAnt;

      const dFimAnt = new Date(dataFim);
      dFimAnt.setDate(1);
      dFimAnt.setFullYear(dFimAnt.getFullYear() - 1);
      const maxDays = new Date(dFimAnt.getFullYear(), dFimAnt.getMonth() + 1, 0).getDate();
      dFimAnt.setDate(Math.min(dataFim.getDate(), maxDays));
      dataFimAnterior = dFimAnt;
    } else {
      const duracaoMs = dataFim.getTime() - dataInicio.getTime();
      dataFimAnterior = new Date(dataInicio.getTime() - 1);
      dataInicioAnterior = new Date(dataFimAnterior.getTime() - duracaoMs);
    }

    // --- Executa as queries em paralelo (Atual e Anterior) ---
    const [lancamentos, agendamentos, todosEstoque, lancamentosAnteriores, agendamentosAnteriores] = await Promise.all([
      prisma.lancamentoFinanceiro.findMany({
        where: { data: { gte: dataInicio, lte: dataFim } } as any,
        include: { 
          servico: { select: { nome: true } },
          agendamento: { select: { servicoId: true, servicosIds: true } }
        },
        orderBy: { data: 'asc' },
      }),
      prisma.agendamento.findMany({
        where: { dataHora: { gte: dataInicio, lte: dataFim } },
        select: { status: true },
      }),
      prisma.estoque.findMany(),
      prisma.lancamentoFinanceiro.findMany({
        where: { data: { gte: dataInicioAnterior, lte: dataFimAnterior } } as any,
      }),
      prisma.agendamento.findMany({
        where: { dataHora: { gte: dataInicioAnterior, lte: dataFimAnterior } },
        select: { status: true },
      })
    ]);

    let faturamentoServicos = 0;
    let faturamentoAtendimentos = 0;
    let faturamentoProdutos = 0;
    let totalSaidas = 0;
    let concluidos = 0;
    let agendamentosConcluidosNaAgenda = 0;
    const porDia: Record<string, { entradas: number; produtos: number; saidas: number }> = {};
    const servicoContagem: Record<string, { nome: string; count: number }> = {};

    const idsServicosSet = new Set<string>();
    lancamentos.forEach((l: any) => {
      if (l.tipo === 'ENTRADA' && l.servicoId) {
        const ids = l.agendamento ? obterIdsServicosAgendamento(l.agendamento) : [l.servicoId];
        ids.forEach(id => idsServicosSet.add(id));
      }
    });

    const servicosNomes = await prisma.servico.findMany({
      where: { id: { in: Array.from(idsServicosSet) } },
      select: { id: true, nome: true }
    });
    const mapaNomesServicos = Object.fromEntries(servicosNomes.map(s => [s.id, s.nome]));

    lancamentos.forEach((l: any) => {
      const valor = Number(l.valor);
      const diaKey = diaBrasiliaStr(new Date(l.data));

      if (!porDia[diaKey]) porDia[diaKey] = { entradas: 0, produtos: 0, saidas: 0 };

      if (l.tipo === 'ENTRADA') {
        if (l.categoria === CATEGORIA_VENDA_PRODUTO) {
          faturamentoProdutos += valor;
          porDia[diaKey].produtos += valor;
        } else {
          faturamentoServicos += valor;
          porDia[diaKey].entradas += valor;

          if (l.servicoId) {
            concluidos++;
            faturamentoAtendimentos += valor;

            // Contagem de serviços
            const ids = l.agendamento ? obterIdsServicosAgendamento(l.agendamento) : [l.servicoId];
            ids.forEach(id => {
              const nome = mapaNomesServicos[id] || l.servico?.nome || 'Serviço Desconhecido';
              if (!servicoContagem[id]) {
                servicoContagem[id] = { nome, count: 0 };
              }
              servicoContagem[id].count++;
            });
          }
        }
      } else {
        totalSaidas += valor;
        porDia[diaKey].saidas += valor;
      }
    });

    // --- Agendamentos no período Atual ---
    agendamentos.forEach((a: any) => {
      if (a.status === 'CONCLUIDO') agendamentosConcluidosNaAgenda++;
    });
    const pendentes = agendamentos.filter((a: any) => a.status === 'AGUARDANDO' || a.status === 'CONFIRMADO').length;

    // --- Processar Período Anterior ---
    let antFaturamentoServicos = 0;
    let antFaturamentoAtendimentos = 0;
    let antFaturamentoProdutos = 0;
    let antTotalSaidas = 0;
    let antConcluidos = 0;
    
    lancamentosAnteriores.forEach((l: any) => {
      const valor = Number(l.valor);
      if (l.tipo === 'ENTRADA') {
        if (l.categoria === CATEGORIA_VENDA_PRODUTO) {
          antFaturamentoProdutos += valor;
        } else {
          antFaturamentoServicos += valor;
          if (l.servicoId) {
            antConcluidos++;
            antFaturamentoAtendimentos += valor;
          }
        }
      } else {
        antTotalSaidas += valor;
      }
    });

    const antAgendamentosConcluidosNaAgenda = agendamentosAnteriores.filter((a: any) => a.status === 'CONCLUIDO').length;
    const antFaturamentoTotal = antFaturamentoServicos + antFaturamentoProdutos;
    const faturamentoTotal = faturamentoServicos + faturamentoProdutos;

    // Ticket médio
    const ticketMedio = concluidos > 0 ? faturamentoAtendimentos / concluidos : 0;
    const antTicketMedio = antConcluidos > 0 ? antFaturamentoAtendimentos / antConcluidos : 0;

    // Função auxiliar para calcular variação % (legado)
    const calcVar = (atual: number, anterior: number): number | null => {
      if (anterior === 0) return null;
      return ((atual - anterior) / anterior) * 100;
    };

    // Preencher dias sem lançamento no range
    const porDiaCompleto: Array<{ data: string; entradas: number; produtos: number; saidas: number }> = [];
    const cursor = new Date(dataInicio);
    const fimLoop = new Date(dataFim);
    while (cursor <= fimLoop) {
      const key = diaBrasiliaStr(cursor);
      porDiaCompleto.push({
        data: key,
        entradas: porDia[key]?.entradas || 0,
        produtos: porDia[key]?.produtos || 0,
        saidas: porDia[key]?.saidas || 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    // Serviço mais realizado
    const servicoMaisRealizado = Object.values(servicoContagem).sort((a, b) => b.count - a.count)[0] || null;

    // --- Estoque baixo (snapshot atual, não depende de período) ---
    const estoqueBaixo = todosEstoque.filter((i: any) => i.quantidade <= i.quantidadeMinima).length;

    // Construir séries cronológicas para o Sparkline (por hora para 1 dia, por dia para múltiplos dias)
    const diffDaysTotal = Math.round((fimDiaBrasilia(fim).getTime() - dataInicio.getTime()) / (1000 * 60 * 60 * 24));
    let serieFaturamentoTotal: number[] = [];
    let serieFaturamentoServicos: number[] = [];
    let serieFaturamentoProdutos: number[] = [];
    let serieAtendimentos: number[] = [];
    let serieTicketMedio: number[] = [];

    if (diffDaysTotal <= 0) {
      // Série por hora (0h a 23h ou até a hora atual)
      const maxHora = (inicio === hojeStr) ? getHoraMinutoBrasilia(agora).hora : 23;
      const horasCount = Math.max(2, maxHora + 1);
      const bucketsServicos = new Array(horasCount).fill(0);
      const bucketsProdutos = new Array(horasCount).fill(0);
      const bucketsAtendimentos = new Array(horasCount).fill(0);

      lancamentos.forEach((l: any) => {
        if (l.tipo === 'ENTRADA') {
          const { hora } = getHoraMinutoBrasilia(new Date(l.data));
          if (hora < horasCount) {
            const valor = Number(l.valor);
            if (l.categoria === CATEGORIA_VENDA_PRODUTO) bucketsProdutos[hora] += valor;
            else bucketsServicos[hora] += valor;
          }
        }
      });

      lancamentos.forEach((l: any) => {
        if (l.tipo === 'ENTRADA' && l.servicoId) {
          const { hora } = getHoraMinutoBrasilia(new Date(l.data));
          if (hora < horasCount) bucketsAtendimentos[hora]++;
        }
      });

      serieFaturamentoServicos = bucketsServicos;
      serieFaturamentoProdutos = bucketsProdutos;
      serieFaturamentoTotal = bucketsServicos.map((v, idx) => v + bucketsProdutos[idx]);
      serieAtendimentos = bucketsAtendimentos;
      serieTicketMedio = bucketsServicos.map((v, idx) => bucketsAtendimentos[idx] > 0 ? v / bucketsAtendimentos[idx] : 0);
    } else {
      serieFaturamentoServicos = porDiaCompleto.map(d => d.entradas);
      serieFaturamentoProdutos = porDiaCompleto.map(d => d.produtos);
      serieFaturamentoTotal = porDiaCompleto.map(d => d.entradas + d.produtos);
      const atendimentosPorDia: Record<string, number> = {};
      lancamentos.forEach((l: any) => {
        if (l.tipo === 'ENTRADA' && l.servicoId) {
          const key = diaBrasiliaStr(new Date(l.data));
          atendimentosPorDia[key] = (atendimentosPorDia[key] || 0) + 1;
        }
      });
      serieAtendimentos = porDiaCompleto.map(d => atendimentosPorDia[d.data] || 0);
      serieTicketMedio = serieFaturamentoServicos.map((v, idx) => serieAtendimentos[idx] > 0 ? v / serieAtendimentos[idx] : 0);
    }

    return {
      totalEntradas: faturamentoTotal,
      faturamentoServicos,
      faturamentoProdutos,
      faturamentoTotal,
      totalSaidas,
      saldo: faturamentoTotal - totalSaidas,
      totalAtendimentos: agendamentosConcluidosNaAgenda,
      atendimentosFechados: concluidos,
      pendentes,
      estoqueBaixo,
      ticketMedio,
      servicoMaisRealizado,
      porDia: porDiaCompleto,
      // Variações percentuais
      variacaoFaturamento: calcVar(faturamentoTotal, antFaturamentoTotal),
      variacaoServicos: calcVar(faturamentoServicos, antFaturamentoServicos),
      variacaoProdutos: calcVar(faturamentoProdutos, antFaturamentoProdutos),
      variacaoAtendimentos: calcVar(agendamentosConcluidosNaAgenda, antAgendamentosConcluidosNaAgenda),
      variacaoAtendimentosFechados: calcVar(concluidos, antConcluidos),
      variacaoTicket: calcVar(ticketMedio, antTicketMedio),
      // Novo formato estruturado por métrica
      metricas: {
        faturamentoTotal: { atual: faturamentoTotal, anterior: antFaturamentoTotal, periodo: periodoCalc, serie: serieFaturamentoTotal },
        faturamentoServicos: { atual: faturamentoServicos, anterior: antFaturamentoServicos, periodo: periodoCalc, serie: serieFaturamentoServicos },
        faturamentoProdutos: { atual: faturamentoProdutos, anterior: antFaturamentoProdutos, periodo: periodoCalc, serie: serieFaturamentoProdutos },
        totalAtendimentos: { atual: concluidos, anterior: antConcluidos, periodo: periodoCalc, serie: serieAtendimentos },
        ticketMedio: { atual: ticketMedio, anterior: antTicketMedio, periodo: periodoCalc, serie: serieTicketMedio },
        totalSaidas: { atual: totalSaidas, anterior: antTotalSaidas, periodo: periodoCalc, serie: porDiaCompleto.map(d => d.saidas) },
        saldo: { atual: faturamentoTotal - totalSaidas, anterior: antFaturamentoTotal - antTotalSaidas, periodo: periodoCalc, serie: porDiaCompleto.map(d => d.entradas + d.produtos - d.saidas) }
      },
      anterior: {
        faturamentoTotal: antFaturamentoTotal,
        faturamentoServicos: antFaturamentoServicos,
        faturamentoProdutos: antFaturamentoProdutos,
        totalAtendimentos: antConcluidos,
        ticketMedio: antTicketMedio
      }
    };
  }
}
