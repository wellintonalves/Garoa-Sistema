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
  diaBrasiliaStr,
} from '../lib/timezone';
import { prepararOperacoesFidelidade, creditarPontosPorAgendamento } from './fidelidade.engine';
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
  barbeariaId?: string;
  origem?: string;
  status?: StatusAgendamento;
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
        historicoRemarcacoes: {
          include: {
            usuarioAcao: { select: { nome: true } },
            barbeiroAnterior: { include: { usuario: { select: { nome: true } } } },
            barbeiroNovo: { include: { usuario: { select: { nome: true } } } },
            servicoAnterior: { select: { nome: true } },
            servicoNovo: { select: { nome: true } }
          },
          orderBy: { criadoEm: 'desc' }
        }
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
        historicoRemarcacoes: {
          include: {
            usuarioAcao: { select: { nome: true } },
            barbeiroAnterior: { include: { usuario: { select: { nome: true } } } },
            barbeiroNovo: { include: { usuario: { select: { nome: true } } } },
            servicoAnterior: { select: { nome: true } },
            servicoNovo: { select: { nome: true } }
          },
          orderBy: { criadoEm: 'desc' }
        }
      },
    });

    if (!agendamento) throw new Error('Agendamento não encontrado');
    const [ag] = await injetarDuracaoTotalServicos([agendamento]);
    return ag;
  }

  /** Valida todas as regras de negócio de um agendamento */
  static async validarAgendamento(
    barbeariaId: string,
    barbeiroId: string,
    clienteId: string,
    dataHora: Date,
    duracaoMinutos: number,
    ignorarAgendamentoId?: string
  ) {
    await HorariosUtil.validarDentroDoFuncionamento({
      barbeariaId,
      barbeiroId,
      dataHora,
      duracaoMinutos
    });

    await HorariosUtil.validarConflitoCliente({
      clienteId,
      dataHora,
      duracaoMinutos,
      ignorarAgendamentoId
    });

    const dataStr = diaBrasiliaStr(dataHora);
    const dataInicioDia = inicioDiaBrasilia(dataStr);
    const dataFimDia = fimDiaBrasilia(dataStr);

    let agendamentosDia = await prisma.agendamento.findMany({
      where: {
        barbeiroId,
        status: { notIn: ['CANCELADO'] },
        dataHora: { gte: dataInicioDia, lte: dataFimDia },
      },
      include: { servico: true }
    });

    agendamentosDia = await injetarDuracaoTotalServicos(agendamentosDia);

    const conflitoAgendamento = agendamentosDia.some(ag => {
      if (ignorarAgendamentoId && ag.id === ignorarAgendamentoId) return false;
      const agInicioM = new Date(ag.dataHora).getTime();
      const agFimM = agInicioM + (((ag as any).duracaoTotal || ag.servico?.duracaoMinutos || 0) * 60000);
      
      const reqInicioM = dataHora.getTime();
      const reqFimM = reqInicioM + (duracaoMinutos * 60000);
      
      return reqInicioM < agFimM && reqFimM > agInicioM;
    });

    if (conflitoAgendamento) {
      throw new Error('Horário já ocupado para este barbeiro');
    }

    const dataFim = new Date(dataHora.getTime() + duracaoMinutos * 60000);
    const conflitoBloqueio = await prisma.bloqueioAgenda.findFirst({
      where: {
        barbeiroId,
        dataInicio: { lt: dataFim },
        dataFim: { gt: dataHora }
      }
    });

    if (conflitoBloqueio) {
      throw new Error('Horário indisponível (bloqueado pelo barbeiro)');
    }
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

    const barbeiro = await prisma.barbeiro.findUnique({ where: { id: dados.barbeiroId }, include: { barbearia: true } });
    if (!barbeiro) throw new Error('Barbeiro não encontrado');

    await this.validarAgendamento(
      barbeiro.barbeariaId!,
      dados.barbeiroId,
      dados.clienteId,
      dataInicio,
      duracaoTotal
    );

    return prisma.agendamento.create({
      data: {
        barbeariaId: dados.barbeariaId || barbeiro.barbeariaId,
        clienteId: dados.clienteId,
        barbeiroId: dados.barbeiroId,
        servicoId: servico.id,
        servicosIds: todosIds,
        dataHora: dataInicio,
        observacoes: dados.observacoes,
        valorCobrado: valorTotal,
        origem: dados.origem || 'ONLINE',
        status: dados.status || 'AGUARDANDO',
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
    >,
    usuarioAcaoId?: string
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

    if (dadosAgendamento.dataHora || dadosAgendamento.servicoId || dadosAgendamento.barbeiroId) {
      const novaDataHora = dadosAgendamento.dataHora
        ? toBrasiliaDate(dadosAgendamento.dataHora)
        : agendamentoOriginal.dataHora;
      let novaDuracao = agendamentoOriginal.servico.duracaoMinutos;

      if (dadosAgendamento.servicoId && dadosAgendamento.servicoId !== agendamentoOriginal.servicoId) {
        const novoServico = await prisma.servico.findUnique({ where: { id: dadosAgendamento.servicoId } });
        if (novoServico) novaDuracao = novoServico.duracaoMinutos;
      }
      
      const novoBarbeiroId = dadosAgendamento.barbeiroId || agendamentoOriginal.barbeiroId;

      await this.validarAgendamento(
        agendamentoOriginal.barbeariaId || '',
        novoBarbeiroId,
        agendamentoOriginal.clienteId,
        novaDataHora,
        novaDuracao,
        id
      );
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

      // 2. Buscar configuração de fidelidade, configuração global, barbeiro e saldo (FORA DA TRANSAÇÃO)
      const [configFidelidade, configGlobal, barbeiro, agregacaoPontos, agregacaoResgates] = await Promise.all([
        prisma.configuracaoFidelidade.findUnique({
          where: { barbeariaId: agendamentoOriginal.barbeariaId! },
        }),
        prisma.configuracao.findUnique({
          where: { barbeariaId: agendamentoOriginal.barbeariaId! },
        }),
        prisma.barbeiro.findUnique({
          where: { id: agendamentoOriginal.barbeiroId },
          select: { comissaoPercent: true, barbeariaId: true },
        }),
        prisma.pontoFidelidade.aggregate({
          where: { clienteId: agendamentoOriginal.clienteId },
          _sum: { pontos: true }
        }),
        prisma.resgateRecompensa.aggregate({
          where: { clienteId: agendamentoOriginal.clienteId, status: { in: ['PENDENTE', 'CONFIRMADO'] } },
          _sum: { pontosUsados: true }
        })
      ]);

      if (!configFidelidade) throw new Error('Configuração de fidelidade não encontrada');
      if (!configGlobal) throw new Error('Configuração geral não encontrada');

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

      // 4. Preparar pontos de acúmulo de fidelidade da visita (FORA DA TRANSAÇÃO)
      // O motor calcula os pontos com base na configuração da barbearia (Bruto ou Líquido)
      const baseParaPontos = configGlobal.baseCalculoPontos === 'VALOR_BRUTO' ? valorBruto : valorFinal;
      const operacoesFidelidade = await prepararOperacoesFidelidade(
        agendamentoOriginal.id,
        agendamentoOriginal.clienteId,
        agendamentoOriginal.barbeariaId!,
        agendamentoOriginal.servicoId,
        baseParaPontos
      );

      // 5. Preparar valores de Comissão
      const comissaoPercent = barbeiro?.comissaoPercent || 50;
      const baseComissao = configGlobal.baseCalculoComissao === 'VALOR_BRUTO' ? valorBruto : valorFinal;
      const valorComissao = (baseComissao * comissaoPercent) / 100;
      const valorLiquido = valorFinal - valorComissao;

      // Usar $transaction para garantir atomicidade total
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

        // B. Debita pontos do cliente (se usou pontos como desconto)
        if (pontosAUsar > 0) {
          await tx.pontoFidelidade.create({
            data: {
              clienteId: agendamentoOriginal.clienteId,
              barbeariaId: agendamentoOriginal.barbeariaId!,
              pontos: -pontosAUsar,
              descricao: `Resgate no serviço ${agendamentoOriginal.servico.nome}`,
              data: new Date(),
            },
          });
        }

        // C. Cria o lançamento financeiro
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
            percentualComissao: comissaoPercent,
            baseComissaoAplicada: configGlobal.baseCalculoComissao,
            data: new Date(),
          },
        });

        // D. Executa operações de fidelidade (credita pontos)
        for (const op of operacoesFidelidade.pontosParaCriar) {
          await tx.pontoFidelidade.create({ data: op });
        }
        
        if (operacoesFidelidade.indicacaoParaAtualizarId) {
          await (tx as any).indicacao.update({
            where: { id: operacoesFidelidade.indicacaoParaAtualizarId },
            data: { pontosAwardados: true }
          });
        }

        return updated;
      });

    } else {
      // Se não está concluindo (apenas reagendando, etc), apenas update simples
      const mudouDataBarbeiroServico = 
        (dadosAgendamento.dataHora && toBrasiliaDate(dadosAgendamento.dataHora).getTime() !== agendamentoOriginal.dataHora.getTime()) || 
        (dadosAgendamento.barbeiroId && dadosAgendamento.barbeiroId !== agendamentoOriginal.barbeiroId) ||
        (dadosAgendamento.servicoId && dadosAgendamento.servicoId !== agendamentoOriginal.servicoId);
      
      const payloadUpdate = {
        ...dadosAgendamento,
        dataHora: dadosAgendamento.dataHora ? toBrasiliaDate(dadosAgendamento.dataHora) : undefined,
      };

      if (dadosAgendamento.servicoId && dadosAgendamento.servicoId !== agendamentoOriginal.servicoId && !dadosAgendamento.servicosIds) {
        (payloadUpdate as any).servicosIds = [dadosAgendamento.servicoId];
      }

      if (mudouDataBarbeiroServico && !payloadUpdate.status) {
        payloadUpdate.status = 'AGUARDANDO';
      }

      resultadoFinal = await prisma.$transaction(async (tx) => {
        const agUpdated = await tx.agendamento.update({
          where: { id },
          data: payloadUpdate as any,
          include: {
            cliente: { include: { usuario: { select: { nome: true } } } },
            barbeiro: { include: { usuario: { select: { nome: true } } } },
            servico: { select: { nome: true, duracaoMinutos: true, cor: true, preco: true } },
          },
        });

        if (mudouDataBarbeiroServico && usuarioAcaoId) {
          await tx.historicoRemarcacao.create({
            data: {
              agendamentoId: id,
              dataHoraAnterior: agendamentoOriginal.dataHora,
              dataHoraNova: payloadUpdate.dataHora || agendamentoOriginal.dataHora,
              barbeiroAnteriorId: agendamentoOriginal.barbeiroId,
              barbeiroNovoId: dadosAgendamento.barbeiroId || agendamentoOriginal.barbeiroId,
              servicoAnteriorId: agendamentoOriginal.servicoId,
              servicoNovoId: dadosAgendamento.servicoId || agendamentoOriginal.servicoId,
              usuarioAcaoId: usuarioAcaoId
            }
          });
        }
        return agUpdated;
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
