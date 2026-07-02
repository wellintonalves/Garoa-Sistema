import { prisma } from '../lib/prisma';
import { toBrasiliaDate } from '../lib/timezone';

export class BloqueioService {
  /**
   * Cria um novo bloqueio de agenda para um barbeiro.
   */
  static async criar(barbeiroId: string, dataInicio: string | Date, dataFim: string | Date, motivo?: string) {
    const inicio = typeof dataInicio === 'string' ? toBrasiliaDate(dataInicio) : dataInicio;
    const fim = typeof dataFim === 'string' ? toBrasiliaDate(dataFim) : dataFim;

    if (fim <= inicio) {
      throw new Error('A data de fim deve ser posterior à data de início.');
    }

    // Verifica se já existe um bloqueio que conflite neste período
    const conflito = await prisma.bloqueioAgenda.findFirst({
      where: {
        barbeiroId,
        OR: [
          {
            dataInicio: { lt: fim },
            dataFim: { gt: inicio }
          }
        ]
      }
    });

    if (conflito) {
      throw new Error('Já existe um bloqueio de agenda neste período.');
    }

    return prisma.bloqueioAgenda.create({
      data: {
        barbeiroId,
        dataInicio: inicio,
        dataFim: fim,
        motivo
      }
    });
  }

  /**
   * Lista bloqueios de um barbeiro específico ou de todos (se admin).
   */
  static async listar(filtros: { barbeiroId?: string, barbeariaId?: string, aPartirDe?: Date }) {
    const where: any = {};
    if (filtros.barbeiroId) {
      where.barbeiroId = filtros.barbeiroId;
    } else if (filtros.barbeariaId) {
      where.barbeiro = { barbeariaId: filtros.barbeariaId };
    }
    if (filtros.aPartirDe) {
      where.dataFim = { gte: filtros.aPartirDe };
    }

    return prisma.bloqueioAgenda.findMany({
      where,
      orderBy: { dataInicio: 'asc' },
      select: {
        id: true,
        barbeiroId: true,
        dataInicio: true,
        dataFim: true,
        motivo: true,
        barbeiro: {
          select: {
            id: true,
            usuario: { select: { nome: true } }
          }
        }
      }
    });
  }

  /**
   * Remove um bloqueio de agenda pelo ID.
   */
  static async remover(id: string) {
    return prisma.bloqueioAgenda.delete({
      where: { id }
    });
  }
}
