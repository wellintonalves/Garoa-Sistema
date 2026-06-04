// Serviço de agendamentos — CRUD + horários livres
import { prisma } from '../lib/prisma';
import { StatusAgendamento } from '@prisma/client';
import {
  toBrasiliaDate,
  inicioDiaBrasilia,
  fimDiaBrasilia,
  getHoraMinutoBrasilia,
  criarDataHoraBrasilia,
  formatarHorario,
} from '../lib/timezone';

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
      const inicio = inicioDiaBrasilia(filtros.data);
      const fim = fimDiaBrasilia(filtros.data);
      where.dataHora = { gte: inicio, lte: fim };
    }

    return prisma.agendamento.findMany({
      where,
      include: {
        cliente: { include: { usuario: { select: { nome: true } } } },
        barbeiro: { include: { usuario: { select: { nome: true } } } },
        servico: { select: { nome: true, duracaoMinutos: true, preco: true, cor: true } },
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

    const dataInicio = toBrasiliaDate(dados.dataHora);
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
        servico: { select: { nome: true, duracaoMinutos: true, cor: true } },
      },
    });
  }

  /** Atualiza status ou dados do agendamento */
  static async atualizar(id: string, dados: Partial<DadosAgendamento & { status: StatusAgendamento }>) {
    return prisma.agendamento.update({
      where: { id },
      data: {
        ...dados,
        dataHora: dados.dataHora ? toBrasiliaDate(dados.dataHora) : undefined,
      } as any,
      include: {
        cliente: { include: { usuario: { select: { nome: true } } } },
        barbeiro: { include: { usuario: { select: { nome: true } } } },
        servico: { select: { nome: true, duracaoMinutos: true, cor: true } },
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
    const inicio = inicioDiaBrasilia(data);
    const fim = fimDiaBrasilia(data);

    // Busca agendamentos do dia (exceto cancelados)
    const agendamentos = await prisma.agendamento.findMany({
      where: {
        barbeiroId,
        dataHora: { gte: inicio, lte: fim },
        status: { not: 'CANCELADO' },
      },
      include: { servico: { select: { duracaoMinutos: true } } },
      orderBy: { dataHora: 'asc' },
    });

    // Busca horários da barbearia (se existir)
    const barbeiro = await prisma.barbeiro.findUnique({
      where: { id: barbeiroId },
      include: { barbearia: true },
    });

    const barbearia = barbeiro?.barbearia;
    const horaAbertura = parseInt(barbearia?.horarioAbertura?.split(':')[0] || '8');
    const minAbertura = parseInt(barbearia?.horarioAbertura?.split(':')[1] || '0');
    const horaFechamento = parseInt(barbearia?.horarioFechamento?.split(':')[0] || '19');
    const minFechamento = parseInt(barbearia?.horarioFechamento?.split(':')[1] || '0');

    const temAlmoco = barbearia?.temAlmoco || false;
    const almocoInicio = barbearia?.horarioAlmocoInicio || '12:00';
    const almocoFim = barbearia?.horarioAlmocoFim || '13:00';
    const almocoInicioMin = parseInt(almocoInicio.split(':')[0]) * 60 + parseInt(almocoInicio.split(':')[1]);
    const almocoFimMin = parseInt(almocoFim.split(':')[0]) * 60 + parseInt(almocoFim.split(':')[1]);

    const inicioMinutos = horaAbertura * 60 + minAbertura;
    const fimMinutos = horaFechamento * 60 + minFechamento;

    // Gera slots de 30 min dentro do horário de funcionamento
    const slots: Array<{ horario: string; ocupado: boolean; agendamentoId?: string }> = [];

    for (let m = inicioMinutos; m < fimMinutos; m += 30) {
      const hora = Math.floor(m / 60);
      const minuto = m % 60;

      // Pula horário de almoço
      if (temAlmoco && m >= almocoInicioMin && m < almocoFimMin) {
        continue;
      }

      const slotInicio = criarDataHoraBrasilia(data, hora, minuto);

      const agendamentoNoSlot = agendamentos.find((ag: any) => {
        const agInicio = new Date(ag.dataHora);
        const agFim = new Date(agInicio.getTime() + ag.servico.duracaoMinutos * 60000);
        return slotInicio >= agInicio && slotInicio < agFim;
      });

      slots.push({
        horario: formatarHorario(hora, minuto),
        ocupado: !!agendamentoNoSlot,
        agendamentoId: agendamentoNoSlot?.id,
      });
    }

    return { data, barbeiroId, slots };
  }
}
