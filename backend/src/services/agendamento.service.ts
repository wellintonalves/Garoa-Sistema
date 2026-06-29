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
  servicosIds?: string[];
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
    if (dados.status === 'CONCLUIDO' && agendamento.clienteId && agendamento.barbeariaId) {
      const config = await prisma.configuracaoFidelidade.findUnique({
        where: { barbeariaId: agendamento.barbeariaId },
      });

      // Só pontua se o programa de fidelidade estiver ativo
      if (config && config.ativo) {
        let pontos = 0;
        let descricao = '';

        // 1. Regra por serviço (prioridade máxima)
        const regrasPorServico = (config.regrasPorServico as Array<{ servicoId: string; pontos: number }> | null) ?? [];
        const regraServico = regrasPorServico.find(r => r.servicoId === agendamento.servicoId);

        if (regraServico && regraServico.pontos > 0) {
          pontos = regraServico.pontos;
          descricao = `${agendamento.servico?.nome} — regra específica do serviço`;
        }
        // 2. Pontos por real gasto
        else if (config.pontosPorReal > 0 && agendamento.servico?.preco) {
          pontos = Math.floor(Number(agendamento.servico.preco) * config.pontosPorReal);
          descricao = `${agendamento.servico.nome} — ${config.pontosPorReal} ponto(s) por R$1,00`;
        }
        // 3. Pontos fixos por visita
        else if (config.pontosPorVisita > 0) {
          pontos = config.pontosPorVisita;
          descricao = `${agendamento.servico?.nome} — visita concluída`;
        }

        // Dobra pontos no aniversário do cliente
        if (pontos > 0 && config.pontosDobroAniversario && agendamento.clienteId) {
          const cliente = await prisma.cliente.findUnique({
            where: { id: agendamento.clienteId },
            select: { dataNascimento: true },
          });

          if (cliente?.dataNascimento) {
            const hoje = new Date();
            const nasc = new Date(cliente.dataNascimento);
            if (
              nasc.getDate() === hoje.getDate() &&
              nasc.getMonth() === hoje.getMonth()
            ) {
              pontos = pontos * 2;
              descricao += ' (dobro — aniversário!)';
            }
          }
        }

        // Registra pontos do cliente
        if (pontos > 0) {
          await prisma.pontoFidelidade.create({
            data: {
              clienteId: agendamento.clienteId,
              barbeariaId: agendamento.barbeariaId,
              pontos,
              descricao,
            },
          });
        }

        // Verifica se é o primeiro agendamento CONCLUIDO do cliente nesta barbearia
        // para premiar quem o indicou
        if ((config as any).pontosPorIndicacao > 0) {
          const concluidosAnteriores = await prisma.agendamento.count({
            where: {
              clienteId: agendamento.clienteId,
              barbeariaId: agendamento.barbeariaId,
              status: 'CONCLUIDO',
              id: { not: agendamento.id },
            },
          });

          if (concluidosAnteriores === 0) {
            // É o primeiro! Verifica se há indicação pendente
            const indicacao = await (prisma as any).indicacao.findFirst({
              where: {
                indicadoId: agendamento.clienteId,
                barbeariaId: agendamento.barbeariaId,
                pontosAwardados: false,
              },
            });

            if (indicacao) {
              const pontosIndicacao = (config as any).pontosPorIndicacao as number;
              await prisma.pontoFidelidade.create({
                data: {
                  clienteId: indicacao.indicadorId,
                  barbeariaId: agendamento.barbeariaId,
                  pontos: pontosIndicacao,
                  descricao: 'Indicação bem-sucedida — amigo completou primeiro agendamento',
                },
              });
              await (prisma as any).indicacao.update({
                where: { id: indicacao.id },
                data: { pontosAwardados: true },
              });
            }
          }
        }
      }
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

      const bloqueioNoSlot = bloqueios.find((bl: any) => {
        return slotInicio >= new Date(bl.dataInicio) && slotInicio < new Date(bl.dataFim);
      });

      slots.push({
        horario: formatarHorario(hora, minuto),
        ocupado: !!agendamentoNoSlot || !!bloqueioNoSlot,
        agendamentoId: agendamentoNoSlot?.id,
        bloqueado: !!bloqueioNoSlot,
        motivoBloqueio: bloqueioNoSlot?.motivo,
      });
    }

    return { data, barbeiroId, slots };
  }
}
