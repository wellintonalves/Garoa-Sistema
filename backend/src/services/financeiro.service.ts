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
      include: { agendamento: { select: { id: true } } },
      orderBy: { data: 'desc' },
    });
  }

  /** Cria um lançamento */
  static async criar(dados: DadosLancamento) {
    return prisma.lancamentoFinanceiro.create({
      data: {
        tipo: dados.tipo,
        categoria: dados.categoria,
        descricao: dados.descricao,
        valor: dados.valor,
        formaPagamento: dados.formaPagamento,
        agendamentoId: dados.agendamentoId || null,
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

    lancamentos.forEach((l) => {
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

      lancamentos.forEach((l) => {
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
}
