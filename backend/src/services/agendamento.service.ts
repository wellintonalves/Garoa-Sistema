// Serviço de agendamentos — CRUD + horários livres
import { prisma } from '../lib/prisma';
import { StatusAgendamento } from '@prisma/client';

interface DadosAgendamento {
  clienteId: string;
  barbeiroId: string;
  servicoId: string;
  dataHora: string;
  observacoes?: string;
  valorCobrado: number;
}

export class AgendamentoService {
  /** Lista agendamentos com filtros opcionais */
  static async listarTodos(filtros?: { barbeiroId?: string; data?: string; status?: StatusAgendamento }) {
    const where: Record<string, unknown> = {};

    if (filtros?.barbeiroId) where.barbeiroId = filtros.barbeiroId;
    if (filtros?.status) where.status = filtros.status;

    if (filtros?.data) {
      const inicio = new Date(filtros.data);
      const fim = new Date(filtros.data);
      fim.setDate(fim.getDate() + 1);
      where.dataHora = { gte: inicio, lt: fim };
    }

    return prisma.agendamento.findMany({
      where,
      include: {
        cliente: { include: { usuario: { select: { nome: true } } } },
        barbeiro: { include: { usuario: { select: { nome: true } } } },
        servico: { select: { nome: true, duracaoMinutos: true, preco: true } },
      },
      orderBy: { dataHora: 'asc' },
    });
  }

  /** Busca agendamento por ID */
  static async buscarPorId(id: string) {
    const agendamento = await prisma.agendamento.findUnique({
      where: { id },
      include: {
        cliente: { include: { usuario: { select: { nome: true, email: true } } } },
        barbeiro: { include: { usuario: { select: { nome: true } } } },
        servico: true,
      },
    });

    if (!agendamento) throw new Error('Agendamento não encontrado');
    return agendamento;
  }

  /** Cria um novo agendamento */
  static async criar(dados: DadosAgendamento) {
    // Verifica conflito de horário
    const servico = await prisma.servico.findUnique({ where: { id: dados.servicoId } });
    if (!servico) throw new Error('Serviço não encontrado');

    const dataInicio = new Date(dados.dataHora);
    const dataFim = new Date(dataInicio.getTime() + servico.duracaoMinutos * 60000);

    const conflito = await prisma.agendamento.findFirst({
      where: {
        barbeiroId: dados.barbeiroId,
        status: { notIn: ['CANCELADO'] },
        dataHora: { lt: dataFim },
        AND: {
          dataHora: { gte: new Date(dataInicio.getTime() - servico.duracaoMinutos * 60000) },
        },
      },
    });

    if (conflito) {
      throw new Error('Horário já ocupado para este barbeiro');
    }

    return prisma.agendamento.create({
      data: {
        clienteId: dados.clienteId,
        barbeiroId: dados.barbeiroId,
        servicoId: dados.servicoId,
        dataHora: dataInicio,
        observacoes: dados.observacoes,
        valorCobrado: dados.valorCobrado,
      } as any,
      include: {
        cliente: { include: { usuario: { select: { nome: true } } } },
        barbeiro: { include: { usuario: { select: { nome: true } } } },
        servico: { select: { nome: true, duracaoMinutos: true } },
      },
    });
  }

  /** Atualiza status ou dados do agendamento */
  static async atualizar(id: string, dados: Partial<DadosAgendamento & { status: StatusAgendamento }>) {
    return prisma.agendamento.update({
      where: { id },
      data: {
        ...dados,
        dataHora: dados.dataHora ? new Date(dados.dataHora) : undefined,
      } as any,
      include: {
        cliente: { include: { usuario: { select: { nome: true } } } },
        barbeiro: { include: { usuario: { select: { nome: true } } } },
        servico: { select: { nome: true, duracaoMinutos: true } },
      },
    });
  }

  /** Cancela um agendamento */
  static async cancelar(id: string) {
    return prisma.agendamento.update({
      where: { id },
      data: { status: 'CANCELADO' } as any,
    });
  }

  /** Retorna horários livres e ocupados de um barbeiro em uma data */
  static async horariosDisponivies(barbeiroId: string, data: string) {
    const inicio = new Date(data);
    inicio.setHours(0, 0, 0, 0);
    const fim = new Date(data);
    fim.setDate(fim.getDate() + 1);

    // Busca agendamentos do dia (exceto cancelados)
    const agendamentos = await prisma.agendamento.findMany({
      where: {
        barbeiroId,
        dataHora: { gte: inicio, lt: fim },
        status: { not: 'CANCELADO' },
      },
      include: { servico: { select: { duracaoMinutos: true } } },
      orderBy: { dataHora: 'asc' },
    });

    // Gera slots de 30 min das 8h às 19h
    const slots: Array<{ horario: string; ocupado: boolean; agendamentoId?: string }> = [];

    for (let hora = 8; hora < 19; hora++) {
      for (const minuto of [0, 30]) {
        const slotInicio = new Date(inicio);
        slotInicio.setHours(hora, minuto, 0, 0);

        const agendamentoNoSlot = agendamentos.find((ag: any) => {
          const agInicio = new Date(ag.dataHora);
          const agFim = new Date(agInicio.getTime() + ag.servico.duracaoMinutos * 60000);
          return slotInicio >= agInicio && slotInicio < agFim;
        });

        slots.push({
          horario: `${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`,
          ocupado: !!agendamentoNoSlot,
          agendamentoId: agendamentoNoSlot?.id,
        });
      }
    }

    return { data, barbeiroId, slots };
  }
}
