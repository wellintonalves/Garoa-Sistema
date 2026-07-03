// Serviço financeiro — CRUD + resumos
import { prisma } from '../lib/prisma';
import { TipoLancamento, FormaPagamento } from '@prisma/client';
import { inicioDiaBrasilia, fimDiaBrasilia } from '../lib/timezone';
import { CATEGORIA_VENDA_PRODUTO } from '../lib/constantes';

interface DadosLancamento {
  tipo: TipoLancamento;
  categoria: string;
  descricao?: string;
  valor: number;
  formaPagamento: FormaPagamento;
  agendamentoId?: string;
  barbeiroId?: string;
  servicoId?: string;
  data: string;
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
        servico: { select: { nome: true } }
      },
      orderBy: { data: 'desc' },
    });
  }

  /** Cria um lançamento */
  static async criar(dados: DadosLancamento) {
    let valorComissao: number | null = null;
    let valorLiquido: number | null = null;

    // Se for serviço prestado e tiver barbeiro vinculado
    if (dados.tipo === 'ENTRADA' && dados.barbeiroId) {
      const barbeiro = await prisma.barbeiro.findUnique({
        where: { id: dados.barbeiroId },
        select: { comissaoPercent: true }
      });

      if (barbeiro) {
        valorComissao = (dados.valor * barbeiro.comissaoPercent) / 100;
        valorLiquido = dados.valor - valorComissao;
      }
    }

    return prisma.lancamentoFinanceiro.create({
      data: {
        tipo: dados.tipo,
        categoria: dados.categoria,
        descricao: dados.descricao,
        valor: dados.valor,
        formaPagamento: dados.formaPagamento,
        agendamentoId: dados.agendamentoId || null,
        barbeiroId: dados.barbeiroId || null,
        servicoId: dados.servicoId || null,
        valorComissao,
        valorLiquido,
        data: inicioDiaBrasilia(dados.data),
      } as any,
    });
  }

  /** Atualiza um lançamento */
  static async atualizar(id: string, dados: Partial<DadosLancamento>, isAdmin: boolean = false) {
    const lancamento = await prisma.lancamentoFinanceiro.findUnique({ where: { id } });
    if (!lancamento) throw new Error('Lançamento não encontrado.');

    if (lancamento.barbeiroId && !isAdmin) {
      const aprovacao = await prisma.aprovacaoEdicao.create({
        data: {
          lancamentoId: id,
          barbeiroId: lancamento.barbeiroId,
          acao: 'EDITAR',
          dadosNovos: JSON.parse(JSON.stringify(dados)),
        }
      });
      return { status: 'PENDENTE', aprovacao };
    }

    return prisma.lancamentoFinanceiro.update({
      where: { id },
      data: {
        ...dados,
        data: dados.data ? inicioDiaBrasilia(dados.data) : undefined,
      } as any,
    });
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
      // Cria a chave YYYY-MM-DD usando a data do banco (para fuso UTC local)
      const diaKey = new Date(l.data).toISOString().split('T')[0];
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
      const diaStr = dia.toISOString().split('T')[0];

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
        servico: { select: { nome: true } }
      },
      orderBy: { data: 'desc' }
    });

    const consolidado = {
      totalBruto: 0,
      totalProdutos: 0,
      totalComissoes: 0,
      totalLiquido: 0,
      totalAtendimentos: 0,
      porBarbeiro: {} as Record<string, { nome: string; bruto: number; comissao: number; liquido: number }>
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
            const liquido = Number(l.valorLiquido) || valor;
            
            consolidado.totalComissoes += comissao;
            consolidado.totalLiquido += liquido;
            consolidado.totalAtendimentos++;

            if (!consolidado.porBarbeiro[l.barbeiroId]) {
              consolidado.porBarbeiro[l.barbeiroId] = { nome: nomeBarbeiro, bruto: 0, comissao: 0, liquido: 0 };
            }
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

  /** Resumo para o Dashboard — aceita período customizável */
  static async dashboardResumo(inicio: string, fim: string) {
    const dataInicio = inicioDiaBrasilia(inicio);
    const dataFim = fimDiaBrasilia(fim);

    // --- Executa as queries em paralelo ---
    const [lancamentos, agendamentos, todosEstoque] = await Promise.all([
      prisma.lancamentoFinanceiro.findMany({
        where: { data: { gte: dataInicio, lte: dataFim } } as any,
        include: { servico: { select: { nome: true } } },
        orderBy: { data: 'asc' },
      }),
      prisma.agendamento.findMany({
        where: { dataHora: { gte: dataInicio, lte: dataFim } },
        select: { status: true },
      }),
      prisma.estoque.findMany()
    ]);

    let faturamentoServicos = 0;
    let faturamentoProdutos = 0;
    let totalSaidas = 0;
    let totalAtendimentos = 0;
    const porDia: Record<string, { entradas: number; produtos: number; saidas: number }> = {};
    const servicoContagem: Record<string, { nome: string; count: number; total: number }> = {};

    lancamentos.forEach((l: any) => {
      const valor = Number(l.valor);
      const diaKey = new Date(l.data).toISOString().split('T')[0];

      if (!porDia[diaKey]) porDia[diaKey] = { entradas: 0, produtos: 0, saidas: 0 };

      if (l.tipo === 'ENTRADA') {
        if (l.categoria === CATEGORIA_VENDA_PRODUTO) {
          faturamentoProdutos += valor;
          porDia[diaKey].produtos += valor;
        } else {
          faturamentoServicos += valor;
          porDia[diaKey].entradas += valor;
          if (l.barbeiroId) totalAtendimentos++;

          // Contagem de serviços
          if (l.servicoId && l.servico) {
            if (!servicoContagem[l.servicoId]) {
              servicoContagem[l.servicoId] = { nome: l.servico.nome, count: 0, total: 0 };
            }
            servicoContagem[l.servicoId].count++;
            servicoContagem[l.servicoId].total += valor;
          }
        }
      } else {
        totalSaidas += valor;
        porDia[diaKey].saidas += valor;
      }
    });

    // Preencher dias sem lançamento no range
    const porDiaCompleto: Array<{ data: string; entradas: number; produtos: number; saidas: number }> = [];
    const cursor = new Date(inicio);
    const fimLoop = new Date(fim);
    while (cursor <= fimLoop) {
      const key = cursor.toISOString().split('T')[0];
      porDiaCompleto.push({
        data: key,
        entradas: porDia[key]?.entradas || 0,
        produtos: porDia[key]?.produtos || 0,
        saidas: porDia[key]?.saidas || 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    // Ticket médio (apenas serviços)
    const ticketMedio = totalAtendimentos > 0 ? faturamentoServicos / totalAtendimentos : 0;

    // Serviço mais realizado
    const servicoMaisRealizado = Object.values(servicoContagem).sort((a, b) => b.count - a.count)[0] || null;

    // --- Agendamentos no período ---
    const concluidos = agendamentos.filter((a: any) => a.status === 'CONCLUIDO').length;
    const pendentes = agendamentos.filter((a: any) => a.status === 'AGUARDANDO' || a.status === 'CONFIRMADO').length;

    // --- Estoque baixo (snapshot atual, não depende de período) ---
    const estoqueBaixo = todosEstoque.filter((i: any) => i.quantidade <= i.quantidadeMinima).length;

    return {
      totalEntradas: faturamentoServicos + faturamentoProdutos,
      faturamentoServicos,
      faturamentoProdutos,
      faturamentoTotal: faturamentoServicos + faturamentoProdutos,
      totalSaidas,
      saldo: (faturamentoServicos + faturamentoProdutos) - totalSaidas,
      totalAtendimentos: concluidos,
      pendentes,
      estoqueBaixo,
      ticketMedio,
      servicoMaisRealizado,
      porDia: porDiaCompleto,
    };
  }
}
