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
import { creditarPontosPorAgendamento } from './fidelidade.engine';
import { HorariosUtil } from './horarios.util';

interface DadosAgendamento {
  clienteId: string;
  barbeiroId: string;
  servicoId: string;
  servicosIds?: string[];
  dataHora: string;
  observacoes?: string;
  valorCobrado: number;
}

export class AgendamentoService {
  /** Lista agendamentos com filtros opcionais */
  static async listarTodos(filtros?: { barbeiroId?: string; data?: string; dataInicio?: string; dataFim?: string; status?: StatusAgendamento }) {
    const where: Record<string, unknown> = {};

    if (filtros?.barbeiroId) where.barbeiroId = filtros.barbeiroId;
    if (filtros?.status) where.status = filtros.status;

    if (filtros?.data) {
      const inicio = inicioDiaBrasilia(filtros.data);
      const fim = fimDiaBrasilia(filtros.data);
      where.dataHora = { gte: inicio, lte: fim };
    } else if (filtros?.dataInicio && filtros?.dataFim) {
      const inicio = inicioDiaBrasilia(filtros.dataInicio);
      const fim = fimDiaBrasilia(filtros.dataFim);
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
    // Suporte a múltiplos serviços — usa servicosIds se fornecido
    const todosIds = dados.servicosIds && dados.servicosIds.length > 0
      ? dados.servicosIds
      : [dados.servicoId];

    // Busca todos os serviços selecionados para calcular duração total
    const todosServicos = await prisma.servico.findMany({ where: { id: { in: todosIds } } });
    if (todosServicos.length === 0) throw new Error('Serviço não encontrado');

    // Usa o primeiro serviço como servicoId (compatibilidade)
    const servico = todosServicos.find(s => s.id === dados.servicoId) || todosServicos[0];
    const duracaoTotal = todosServicos.reduce((acc, s) => acc + s.duracaoMinutos, 0);
    const valorTotal = dados.servicosIds && dados.servicosIds.length > 0
      ? todosServicos.reduce((acc, s) => acc + Number(s.preco), 0)
      : dados.valorCobrado;

    const dataInicio = toBrasiliaDate(dados.dataHora);
    const dataFim = new Date(dataInicio.getTime() + duracaoTotal * 60000);

    const barbeiro = await prisma.barbeiro.findUnique({ where: { id: dados.barbeiroId }, include: { barbearia: true } });
    if (!barbeiro) throw new Error('Barbeiro não encontrado');

    await HorariosUtil.validarDentroDoFuncionamento({
      barbeariaId: barbeiro.barbeariaId,
      dataHora: dataInicio,
      duracaoMinutos: duracaoTotal
    });

    const dataStr = dados.dataHora.split('T')[0] || dataInicio.toISOString().split('T')[0];
    const dataInicioDia = inicioDiaBrasilia(dataStr);
    const dataFimDia = fimDiaBrasilia(dataStr);

    const agendamentosDia = await prisma.agendamento.findMany({
      where: {
        barbeiroId: dados.barbeiroId,
        status: { notIn: ['CANCELADO'] },
        dataHora: { gte: dataInicioDia, lte: dataFimDia },
      },
      include: { servico: true }
    });

    const conflitoAgendamento = agendamentosDia.some(ag => {
      const agDate = new Date(ag.dataHora);
      const agInicioM = agDate.getUTCHours() * 60 + agDate.getUTCMinutes();
      const agFimM = agInicioM + ag.servico.duracaoMinutos;
      
      const reqInicioM = dataInicio.getUTCHours() * 60 + dataInicio.getUTCMinutes();
      const reqFimM = reqInicioM + duracaoTotal;
      
      return reqInicioM < agFimM && reqFimM > agInicioM;
    });

    if (conflitoAgendamento) {
      throw new Error('Horário já ocupado para este barbeiro');
    }

    const conflitoBloqueio = await prisma.bloqueioAgenda.findFirst({
      where: {
        barbeiroId: dados.barbeiroId,
        dataInicio: { lt: dataFim },
        dataFim: { gt: dataInicio }
      }
    });

    if (conflitoBloqueio) {
      throw new Error('Horário indisponível (bloqueado pelo barbeiro)');
    }

    return prisma.agendamento.create({
      data: {
        clienteId: dados.clienteId,
        barbeiroId: dados.barbeiroId,
        servicoId: servico.id,
        servicosIds: todosIds,
        dataHora: dataInicio,
        observacoes: dados.observacoes,
        valorCobrado: valorTotal,
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
    const agendamentoOriginal = await prisma.agendamento.findUnique({ where: { id } });
    const statusOriginal = agendamentoOriginal?.status;

    const agendamento = await prisma.agendamento.update({
      where: { id },
      data: {
        ...dados,
        dataHora: dados.dataHora ? toBrasiliaDate(dados.dataHora) : undefined,
      } as any,
      include: {
        cliente: { include: { usuario: { select: { nome: true } } } },
        barbeiro: { include: { usuario: { select: { nome: true } } } },
        servico: { select: { nome: true, duracaoMinutos: true, cor: true, preco: true } },
      },
    });

    // Lógica de pontuação — só executa quando o status muda para CONCLUIDO
    if (dados.status === 'CONCLUIDO' && statusOriginal !== 'CONCLUIDO') {
      await creditarPontosPorAgendamento(agendamento.id);
    }

    return agendamento;
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

    // Busca bloqueios do dia
    const bloqueios = await prisma.bloqueioAgenda.findMany({
      where: {
        barbeiroId,
        dataInicio: { lte: fim },
        dataFim: { gte: inicio },
      }
    });

    const barbeiro = await prisma.barbeiro.findUnique({
      where: { id: barbeiroId },
      include: { barbearia: true },
    });

    const configDia = await HorariosUtil.getConfigDia(barbeiro?.barbeariaId, data);

    const slots = HorariosUtil.gerarSlotsDisponiveis({
      dataStr: data,
      configDia,
      duracaoMinutos: 30, // grade de exibição de 30 min
      agendamentos,
      bloqueios
    }).map(s => ({
      horario: s.horario,
      ocupado: s.ocupado || false,
      agendamentoId: s.agendamentoId,
      bloqueado: s.bloqueado || false,
      motivoBloqueio: s.motivoBloqueio
    }));

    return { data, barbeiroId, slots };
  }
}
