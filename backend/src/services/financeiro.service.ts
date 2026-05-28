// Serviço financeiro — CRUD + resumos
import { prisma } from '../lib/prisma';
import { TipoLancamento, FormaPagamento } from '@prisma/client';

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
      if (filtros.inicio) (where.data as Record<string, Date>).gte = new Date(filtros.inicio);
      if (filtros.fim) {
        const fim = new Date(filtros.fim);
        fim.setDate(fim.getDate() + 1);
        (where.data as Record<string, Date>).lt = fim;
      }
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
    let valorComissao = null;
    let valorLiquido = null;

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
        data: new Date(dados.data),
      },
    });
  }

  /** Atualiza um lançamento */
  static async atualizar(id: string, dados: Partial<DadosLancamento>) {
    return prisma.lancamentoFinanceiro.update({
      where: { id },
      data: {
        ...dados,
        data: dados.data ? new Date(dados.data) : undefined,
      },
    });
  }

  /** Remove um lançamento */
  static async remover(id: string) {
    return prisma.lancamentoFinanceiro.delete({ where: { id } });
  }

  /** Resumo do dia — total por forma de pagamento */
  static async resumoDoDia(data: string) {
    const inicio = new Date(data);
    inicio.setHours(0, 0, 0, 0);
    const fim = new Date(data);
    fim.setDate(fim.getDate() + 1);

    const lancamentos = await prisma.lancamentoFinanceiro.findMany({
      where: { data: { gte: inicio, lt: fim } },
    });

    const porFormaPagamento: Record<string, number> = {};
    let totalEntradas = 0;
    let totalSaidas = 0;

    lancamentos.forEach((l: any) => {
      const valor = Number(l.valor);
      const forma = l.formaPagamento;

      if (!porFormaPagamento[forma]) porFormaPagamento[forma] = 0;

      if (l.tipo === 'ENTRADA') {
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
      totalSaidas,
      saldo: totalEntradas - totalSaidas,
      porFormaPagamento,
      totalLancamentos: lancamentos.length,
    };
  }

  /** Resumo dos últimos 7 dias (para gráfico) */
  static async ultimos7Dias() {
    const resultado: Array<{ data: string; entradas: number; saidas: number }> = [];

    for (let i = 6; i >= 0; i--) {
      const dia = new Date();
      dia.setDate(dia.getDate() - i);
      dia.setHours(0, 0, 0, 0);

      const fimDia = new Date(dia);
      fimDia.setDate(fimDia.getDate() + 1);

      const lancamentos = await prisma.lancamentoFinanceiro.findMany({
        where: { data: { gte: dia, lt: fimDia } },
      });

      let entradas = 0;
      let saidas = 0;

      lancamentos.forEach((l: any) => {
        const valor = Number(l.valor);
        if (l.tipo === 'ENTRADA') entradas += valor;
        else saidas += valor;
      });

      resultado.push({
        data: dia.toISOString().split('T')[0],
        entradas,
        saidas,
      });
    }

    return resultado;
  }

  /** Relatório detalhado financeiro */
  static async relatorio(filtros: { inicio: string; fim: string; barbeiroId?: string }) {
    const where: any = {};
    
    if (filtros.inicio || filtros.fim) {
      where.data = {};
      if (filtros.inicio) where.data.gte = new Date(filtros.inicio);
      if (filtros.fim) {
        const fim = new Date(filtros.fim);
        fim.setDate(fim.getDate() + 1);
        where.data.lt = fim;
      }
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
      totalComissoes: 0,
      totalLiquido: 0,
      totalAtendimentos: 0,
      porBarbeiro: {} as Record<string, { nome: string; bruto: number; comissao: number; liquido: number }>
    };

    lancamentos.forEach((l: any) => {
      const valor = Number(l.valor);
      
      if (l.tipo === 'ENTRADA') {
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
          // Entradas sem barbeiro (ex: produtos) vão pro líquido integral
          consolidado.totalLiquido += valor;
        }
      }
    });

    return { consolidado, lancamentos };
  }

  /** Resumo para o Dashboard — aceita período customizável */
  static async dashboardResumo(inicio: string, fim: string) {
    const dataInicio = new Date(inicio);
    const dataFim = new Date(fim);
    dataFim.setDate(dataFim.getDate() + 1); // inclui o dia final

    // --- Lançamentos financeiros do período ---
    const lancamentos = await prisma.lancamentoFinanceiro.findMany({
      where: { data: { gte: dataInicio, lt: dataFim } },
      include: { servico: { select: { nome: true } } },
      orderBy: { data: 'asc' },
    });

    let totalEntradas = 0;
    let totalSaidas = 0;
    let totalAtendimentos = 0;
    const porDia: Record<string, { entradas: number; saidas: number }> = {};
    const servicoContagem: Record<string, { nome: string; count: number; total: number }> = {};

    lancamentos.forEach((l: any) => {
      const valor = Number(l.valor);
      const diaKey = new Date(l.data).toISOString().split('T')[0];

      if (!porDia[diaKey]) porDia[diaKey] = { entradas: 0, saidas: 0 };

      if (l.tipo === 'ENTRADA') {
        totalEntradas += valor;
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
      } else {
        totalSaidas += valor;
        porDia[diaKey].saidas += valor;
      }
    });

    // Preencher dias sem lançamento no range
    const porDiaCompleto: Array<{ data: string; entradas: number; saidas: number }> = [];
    const cursor = new Date(inicio);
    const fimLoop = new Date(fim);
    while (cursor <= fimLoop) {
      const key = cursor.toISOString().split('T')[0];
      porDiaCompleto.push({
        data: key,
        entradas: porDia[key]?.entradas || 0,
        saidas: porDia[key]?.saidas || 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    // Ticket médio
    const ticketMedio = totalAtendimentos > 0 ? totalEntradas / totalAtendimentos : 0;

    // Serviço mais realizado
    const servicoMaisRealizado = Object.values(servicoContagem).sort((a, b) => b.count - a.count)[0] || null;

    // --- Agendamentos no período ---
    const agendamentos = await prisma.agendamento.findMany({
      where: { dataHora: { gte: dataInicio, lt: dataFim } },
      select: { status: true },
    });

    const concluidos = agendamentos.filter((a: any) => a.status === 'CONCLUIDO').length;
    const pendentes = agendamentos.filter((a: any) => a.status === 'AGUARDANDO' || a.status === 'CONFIRMADO').length;

    // --- Estoque baixo (snapshot atual, não depende de período) ---
    const todosEstoque = await prisma.estoque.findMany();
    const estoqueBaixo = todosEstoque.filter((i: any) => i.quantidade <= i.quantidadeMinima).length;

    return {
      totalEntradas,
      totalSaidas,
      saldo: totalEntradas - totalSaidas,
      totalAtendimentos: concluidos,
      pendentes,
      estoqueBaixo,
      ticketMedio,
      servicoMaisRealizado,
      porDia: porDiaCompleto,
    };
  }
}
