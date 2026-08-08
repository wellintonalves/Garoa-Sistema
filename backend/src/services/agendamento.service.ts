// Serviço de agendamentos — CRUD + horários livres
import { prisma } from '../lib/prisma';
import { StatusAgendamento, FormaPagamento } from '@prisma/client';
import {
  toBrasiliaDate,
  inicioDiaBrasilia,
  fimDiaBrasilia,
  getHoraMinutoBrasilia,
  criarDataHoraBrasilia,
  formatarHorario,
} from '../lib/timezone';
import { creditarPontosPorAgendamento } from './fidelidade.engine';
import { HorariosUtil, injetarDuracaoTotalServicos } from './horarios.util';
import { DescontoService, TipoDesconto } from './desconto.service';

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

    const agendamentos = await prisma.agendamento.findMany({
      where,
      include: {
        cliente: { include: { usuario: { select: { nome: true } } } },
        barbeiro: { include: { usuario: { select: { nome: true } } } },
        servico: { select: { nome: true, duracaoMinutos: true, preco: true, cor: true } },
      },
      orderBy: { dataHora: 'asc' },
    });
    
    return injetarDuracaoTotalServicos(agendamentos);
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
    const [ag] = await injetarDuracaoTotalServicos([agendamento]);
    return ag;
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

    await HorariosUtil.validarConflitoCliente({
      clienteId: dados.clienteId,
      dataHora: dataInicio,
      duracaoMinutos: duracaoTotal
    });

    const dataStr = dados.dataHora.split('T')[0] || dataInicio.toISOString().split('T')[0];
    const dataInicioDia = inicioDiaBrasilia(dataStr);
    const dataFimDia = fimDiaBrasilia(dataStr);

    let agendamentosDia = await prisma.agendamento.findMany({
      where: {
        barbeiroId: dados.barbeiroId,
        status: { notIn: ['CANCELADO'] },
        dataHora: { gte: dataInicioDia, lte: dataFimDia },
      },
      include: { servico: true }
    });

    agendamentosDia = await injetarDuracaoTotalServicos(agendamentosDia);

    const conflitoAgendamento = agendamentosDia.some(ag => {
      const agDate = new Date(ag.dataHora);
      const agInicioM = agDate.getUTCHours() * 60 + agDate.getUTCMinutes();
      const agFimM = agInicioM + ((ag as any).duracaoTotal || ag.servico?.duracaoMinutos || 0);
      
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
  static async atualizar(
    id: string,
    dados: Partial<
      DadosAgendamento & {
        status: StatusAgendamento;
        formaPagamento?: FormaPagamento;
      }
    >
  ) {
    const { formaPagamento, tipoDesconto, pontosUsados, descontoPercentual, descontoReais, ...dadosAgendamento } = dados as any;

    const agendamentoOriginal = await prisma.agendamento.findUnique({
      where: { id },
      include: { servico: true },
    });

    if (!agendamentoOriginal) {
      throw new Error('Agendamento não encontrado');
    }

    if (agendamentoOriginal.status === 'CONCLUIDO') {
      const error: any = new Error('Este agendamento já foi concluído e não pode ser alterado.');
      error.status = 409;
      throw error;
    }

    const statusOriginal = agendamentoOriginal.status;

    if (dadosAgendamento.dataHora || dadosAgendamento.servicoId) {
      const novaDataHora = dadosAgendamento.dataHora
        ? toBrasiliaDate(dadosAgendamento.dataHora)
        : agendamentoOriginal.dataHora;
      let novaDuracao = agendamentoOriginal.servico.duracaoMinutos;

      if (dadosAgendamento.servicoId && dadosAgendamento.servicoId !== agendamentoOriginal.servicoId) {
        const novoServico = await prisma.servico.findUnique({ where: { id: dadosAgendamento.servicoId } });
        if (novoServico) novaDuracao = novoServico.duracaoMinutos;
      }

      await HorariosUtil.validarConflitoCliente({
        clienteId: agendamentoOriginal.clienteId,
        dataHora: novaDataHora,
        duracaoMinutos: novaDuracao,
        ignorarAgendamentoId: id,
      });
    }

    // Limpa propriedades extras que não pertencem ao modelo Agendamento para o update
    delete (dadosAgendamento as any).formaPagamento;
    delete (dadosAgendamento as any).pontosUsados;
    delete (dadosAgendamento as any).descontoPercentual;
    delete (dadosAgendamento as any).descontoReais;

    let resultadoFinal: any = null;

    if ((dadosAgendamento.status as string) === 'CONCLUIDO' && (statusOriginal as string) !== 'CONCLUIDO') {
      // 1. Validar forma de pagamento
      const formasPermitidas = Object.values(FormaPagamento);
      if (formaPagamento && !formasPermitidas.includes(formaPagamento as FormaPagamento)) {
        const error: any = new Error('Forma de pagamento inválida.');
        error.status = 400;
        throw error;
      }

      // 2. Buscar configuração de fidelidade e saldo
      const configFidelidade = await prisma.configuracaoFidelidade.findUnique({
        where: { barbeariaId: agendamentoOriginal.barbeariaId! },
      });
      if (!configFidelidade) throw new Error('Configuração de fidelidade não encontrada');

      const [agregacaoPontos, agregacaoResgates] = await Promise.all([
        prisma.pontoFidelidade.aggregate({
          where: { clienteId: agendamentoOriginal.clienteId },
          _sum: { pontos: true }
        }),
        prisma.resgateRecompensa.aggregate({
          where: { clienteId: agendamentoOriginal.clienteId, status: { in: ['PENDENTE', 'CONFIRMADO'] } },
          _sum: { pontosUsados: true }
        })
      ]);
      const totalGanho = agregacaoPontos._sum.pontos || 0;
      const totalGasto = agregacaoResgates._sum.pontosUsados || 0;
      const saldoPontos = totalGanho - totalGasto;

      // 3. Calcular descontos usando DescontoService
      const valorBruto = Number(agendamentoOriginal.servico.preco);
      
      const resultadoDesconto = DescontoService.calcularDesconto({
        valorBruto,
        tipo: tipoDesconto as TipoDesconto || 'NENHUM',
        valorReais: descontoReais ? Number(descontoReais) : 0,
        percentual: descontoPercentual ? Number(descontoPercentual) : 0,
        pontos: pontosUsados ? Number(pontosUsados) : 0,
        saldoPontos,
        config: {
          resgatePontosAtivo: configFidelidade.resgatePontosAtivo ?? false,
          valorPorPonto: Number(configFidelidade.valorPorPonto),
          percentualMaxPontos: Number(configFidelidade.percentualMaxPontos),
          descontoMaxReais: Number(configFidelidade.descontoMaxReais),
          descontoMaxPercentual: Number(configFidelidade.descontoMaxPercentual),
          permitirCombinarDescontos: configFidelidade.permitirCombinarDescontos ?? false
        }
      });

      const valorFinal = resultadoDesconto.valorLiquido;
      const pontosAUsar = resultadoDesconto.pontosUtilizados;

      // Usar $transaction para garantir atomicidade
      resultadoFinal = await prisma.$transaction(async (tx) => {
        // A. Atualiza o agendamento
        const updated = await tx.agendamento.update({
          where: { id },
          data: {
            ...dadosAgendamento,
            valorCobrado: valorFinal,
            tipoDesconto: tipoDesconto as TipoDesconto || 'NENHUM',
            descontoPercentualAplic: descontoPercentual ? Number(descontoPercentual) : null,
            descontoManual: descontoReais ? Number(descontoReais) : 0,
            descontoPontos: Number(resultadoDesconto.descontoPontos),
            pontosUtilizados: pontosAUsar,
            valorBruto: Number(resultadoDesconto.valorBruto),
            valorDesconto: Number(resultadoDesconto.valorDesconto),
            valorLiquido: Number(resultadoDesconto.valorLiquido),
            dataHora: dadosAgendamento.dataHora ? toBrasiliaDate(dadosAgendamento.dataHora) : undefined,
          } as any,
          include: {
            cliente: { include: { usuario: { select: { nome: true } } } },
            barbeiro: { include: { usuario: { select: { nome: true } } } },
            servico: { select: { nome: true, duracaoMinutos: true, cor: true, preco: true } },
          },
        });

        // B. Debita pontos do cliente (se usou pontos)
        if (pontosAUsar > 0) {
          await tx.pontoFidelidade.create({
            data: {
              clienteId: agendamentoOriginal.clienteId,
              barbeariaId: agendamentoOriginal.barbeariaId,
              pontos: -pontosAUsar,
              descricao: `Resgate no serviço ${agendamentoOriginal.servico.nome}`,
              data: new Date(),
            },
          });
        }

        // C. Cria o lançamento financeiro
        const barbeiro = await tx.barbeiro.findUnique({
          where: { id: agendamentoOriginal.barbeiroId },
          select: { comissaoPercent: true, barbeariaId: true },
        });

        // Comissão é sobre o VALOR BRUTO
        const comissaoPercent = barbeiro?.comissaoPercent || 50;
        const valorComissao = (valorBruto * comissaoPercent) / 100;
        
        // A receita da barbearia será o valor final (pago pelo cliente) menos a comissão (baseada no bruto)
        // Isso reflete o fato de que o desconto é um custo comercial da barbearia
        const valorLiquido = valorFinal - valorComissao;

        await tx.lancamentoFinanceiro.create({
          data: {
            barbeariaId: agendamentoOriginal.barbeariaId || barbeiro?.barbeariaId || '',
            tipo: 'ENTRADA',
            categoria: 'Serviço',
            descricao: `${agendamentoOriginal.servico.nome} — concluído pelo painel`,
            valor: valorFinal,
            formaPagamento: formaPagamento || 'PIX',
            agendamentoId: updated.id,
            barbeiroId: agendamentoOriginal.barbeiroId,
            servicoId: agendamentoOriginal.servicoId,
            valorComissao,
            valorLiquido,
            data: new Date(),
          },
        });

        return updated;
      });

      // D. Creditar pontos ganhos pelo agendamento concluído (fora da tx principal pq envolve regras complexas do fidelidade.engine.ts)
      // Como o motor usa chamadas separadas e `find` em outras configurações, é seguro rodar logo após a transação
      await creditarPontosPorAgendamento(resultadoFinal.id);

    } else {
      // Se não está concluindo (apenas reagendando, etc), apenas update simples
      resultadoFinal = await prisma.agendamento.update({
        where: { id },
        data: {
          ...dadosAgendamento,
          dataHora: dadosAgendamento.dataHora ? toBrasiliaDate(dadosAgendamento.dataHora) : undefined,
        } as any,
        include: {
          cliente: { include: { usuario: { select: { nome: true } } } },
          barbeiro: { include: { usuario: { select: { nome: true } } } },
          servico: { select: { nome: true, duracaoMinutos: true, cor: true, preco: true } },
        },
      });
    }

    return resultadoFinal;
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
      include: { servico: { select: { duracaoMinutos: true, nome: true, id: true } } },
      orderBy: { dataHora: 'asc' },
    });
    const agendamentosComDuracao = await injetarDuracaoTotalServicos(agendamentos);

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

    const configDia = await HorariosUtil.getConfigDia(barbeiro?.barbeariaId, data, barbeiroId);

    const slots = HorariosUtil.gerarSlotsDisponiveis({
      dataStr: data,
      configDia,
      duracaoMinutos: 30, // grade de exibição de 30 min
      agendamentos: agendamentosComDuracao,
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

  /** Simula o valor de desconto e pontos antes de concluir */
  static async simularDesconto(
    agendamentoId: string,
    tipoDesconto: TipoDesconto,
    descontoReais: number = 0,
    descontoPercentual: number = 0,
    pontosUsados: number = 0
  ) {
    const agendamento = await prisma.agendamento.findUnique({
      where: { id: agendamentoId },
      include: { servico: true },
    });

    if (!agendamento) throw new Error('Agendamento não encontrado');

    const [configFidelidade, agregacaoPontos, agregacaoResgates] = await Promise.all([
      prisma.configuracaoFidelidade.findUnique({
        where: { barbeariaId: agendamento.barbeariaId! },
      }),
      prisma.pontoFidelidade.aggregate({
        where: { clienteId: agendamento.clienteId },
        _sum: { pontos: true }
      }),
      prisma.resgateRecompensa.aggregate({
        where: { clienteId: agendamento.clienteId, status: { in: ['PENDENTE', 'CONFIRMADO'] } },
        _sum: { pontosUsados: true }
      })
    ]);

    if (!configFidelidade) throw new Error('Configuração de fidelidade não encontrada');

    const totalGanho = agregacaoPontos._sum.pontos || 0;
    const totalGasto = agregacaoResgates._sum.pontosUsados || 0;
    const saldoPontos = totalGanho - totalGasto;

    const valorBruto = Number(agendamento.servico.preco);

    return DescontoService.calcularDesconto({
      valorBruto,
      tipo: tipoDesconto,
      valorReais: descontoReais,
      percentual: descontoPercentual,
      pontos: pontosUsados,
      saldoPontos,
      config: {
        resgatePontosAtivo: configFidelidade.resgatePontosAtivo ?? false,
        valorPorPonto: Number(configFidelidade.valorPorPonto),
        percentualMaxPontos: Number(configFidelidade.percentualMaxPontos),
        descontoMaxReais: Number(configFidelidade.descontoMaxReais),
        descontoMaxPercentual: Number(configFidelidade.descontoMaxPercentual),
        permitirCombinarDescontos: configFidelidade.permitirCombinarDescontos ?? false
      }
    });
  }
}
