// Serviço de relatórios — faturamento, ticket médio, comissões
import { prisma } from '../lib/prisma';
import { inicioDiaBrasilia, fimDiaBrasilia } from '../lib/timezone';

export class RelatorioService {
  /** Resumo geral por período */
  static async resumo(inicio: string, fim: string) {
    const dataInicio = inicioDiaBrasilia(inicio);
    const dataFim = fimDiaBrasilia(fim);

    // Agendamentos concluídos no período
    const agendamentos = await prisma.agendamento.findMany({
      where: {
        dataHora: { gte: dataInicio, lte: dataFim },
        status: 'CONCLUIDO',
      },
      include: {
        barbeiro: {
          include: { usuario: { select: { nome: true } } },
        },
        servico: true,
      },
    });

    // Faturamento total
    const faturamento = agendamentos.reduce(
      (total: any, ag: any) => total + Number(ag.valorCobrado),
      0
    );

    // Total de atendimentos
    const totalAtendimentos = agendamentos.length;

    // Ticket médio
    const ticketMedio = totalAtendimentos > 0 ? faturamento / totalAtendimentos : 0;

    // Comissões por barbeiro
    const comissoesPorBarbeiro: Array<{
      barbeiroId: string;
      nome: string;
      atendimentos: number;
      faturamento: number;
      comissao: number;
    }> = [];

    const agrupado = new Map<string, typeof agendamentos>();
    agendamentos.forEach((ag: any) => {
      const lista = agrupado.get(ag.barbeiroId) || [];
      lista.push(ag);
      agrupado.set(ag.barbeiroId, lista);
    });

    for (const [barbeiroId, ags] of agrupado) {
      const barbeiro = await prisma.barbeiro.findUnique({
        where: { id: barbeiroId },
        include: { usuario: { select: { nome: true } } },
      });

      const faturamentoBarbeiro = ags.reduce(
        (total: any, ag: any) => total + Number(ag.valorCobrado),
        0
      );

      const comissaoPercent = barbeiro?.comissaoPercent || 50;

      comissoesPorBarbeiro.push({
        barbeiroId,
        nome: barbeiro?.usuario.nome || 'Desconhecido',
        atendimentos: ags.length,
        faturamento: faturamentoBarbeiro,
        comissao: (faturamentoBarbeiro * comissaoPercent) / 100,
      });
    }

    return {
      periodo: { inicio, fim },
      faturamento,
      totalAtendimentos,
      ticketMedio,
      comissoesPorBarbeiro,
    };
  }
}
