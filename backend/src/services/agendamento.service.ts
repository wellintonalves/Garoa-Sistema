// Serviço de agendamentos — CRUD + horários livres
import { prisma } from '../lib/prisma';
import { StatusAgendamento, FormaPagamento, Prisma } from '@prisma/client';
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
import { obterIdsServicosAgendamento } from '../utils/agendamento.util';
import { validarSaldoParaResgate, tratarConflitoDeFechamento } from './saldoFidelidade.util';
import { ErroDeNegocio } from '../lib/erros';
import { AtorAgenda, escopoAgenda, validarVinculoCliente } from './acessoAgenda.service';
import { validarAlteracaoAgendamento } from '../utils/agendamentoEntrada.util';
import { listaIds, texto, opcao, objetoPermitido } from '../utils/entradaSegura.util';
import { tenantStorage } from '../lib/als';
interface DadosAgendamento {
  clienteId: string;
  barbeiroId: string;
  servicoId: string;
  servicosIds?: string[];
  dataHora: string;
  observacoes?: string;
  barbeariaId: string;
  origem?: string;
  status?: StatusAgendamento;
}

export class AgendamentoService {
  /** Lista agendamentos com filtros opcionais */
  static async listarTodos(filtros: { barbeiroId?: string; data?: string; dataInicio?: string; dataFim?: string; status?: StatusAgendamento }, ator: AtorAgenda) {
    const escopo = await escopoAgenda(ator);
    const where: Prisma.AgendamentoWhereInput = { ...escopo };

    if (filtros?.barbeiroId && !escopo.barbeiroId) where.barbeiroId = filtros.barbeiroId;
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
  static async buscarPorId(id: string, ator: AtorAgenda) {
    const escopo = await escopoAgenda(ator);
    const agendamento = await prisma.agendamento.findFirst({
      where: { id, ...escopo },
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

    if (!agendamento) throw new ErroDeNegocio('Agendamento não encontrado.', 404);
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
  static async criar(dados: DadosAgendamento, ator: AtorAgenda) {
    objetoPermitido(dados, ['barbeariaId', 'clienteId', 'barbeiroId', 'servicoId', 'servicosIds', 'dataHora', 'observacoes', 'origem', 'status']);
    const origem = dados.origem === undefined ? 'ONLINE' : opcao(dados.origem, ['ONLINE', 'SISTEMA', 'APP_CLIENTE'] as const);
    const status = dados.status === undefined ? 'AGUARDANDO' : opcao(dados.status, ['AGUARDANDO', 'CONFIRMADO'] as const);
    const barbeariaId = texto(dados.barbeariaId);
    const clienteId = texto(dados.clienteId);
    const barbeiroId = texto(dados.barbeiroId);
    const servicoId = texto(dados.servicoId);
    const todosIds = listaIds(dados.servicosIds ?? [servicoId]);
    if (!todosIds.includes(servicoId)) throw new ErroDeNegocio('Seleção de serviços inválida.');
    const contexto = tenantStorage.getStore()?.barbeariaId;
    if (contexto && contexto !== barbeariaId) throw new ErroDeNegocio('Acesso não autorizado.', 403);
    if (!ator?.id || ator.barbeariaId !== barbeariaId) throw new ErroDeNegocio('Acesso não autorizado.', 403);
    if (ator.papel === 'CLIENTE') {
      const identidade = await prisma.cliente.findFirst({
        where: { id: clienteId, usuarioId: ator.id, usuario: { papel: 'CLIENTE', emailVerificado: true } }, select: { id: true },
      });
      if (!identidade) throw new ErroDeNegocio('Acesso não autorizado.', 403);
    } else {
      const escopo = await escopoAgenda(ator);
      if (escopo.barbeariaId !== barbeariaId || (escopo.barbeiroId && escopo.barbeiroId !== barbeiroId)) {
        throw new ErroDeNegocio('Acesso não autorizado.', 403);
      }
    }
    const barbeiro = await prisma.barbeiro.findFirst({
      where: { id: barbeiroId, barbeariaId, ativo: true, barbearia: { ativo: true } },
    });
    if (!barbeiro) throw new ErroDeNegocio('Barbeiro não disponível nesta barbearia.', 404);
    await validarVinculoCliente(clienteId, barbeariaId);
    const todosServicos = await prisma.servico.findMany({ where: { id: { in: todosIds }, barbeariaId, ativo: true } });
    if (todosServicos.length !== todosIds.length) throw new ErroDeNegocio('Serviço não disponível nesta barbearia.', 404);
    const servico = todosServicos.find(s => s.id === servicoId)!;
    const duracaoTotal = todosServicos.reduce((acc, s) => acc + s.duracaoMinutos, 0);
    const valorTotal = todosServicos.reduce((acc, s) => acc + Number(s.preco), 0);
    const dataInicio = toBrasiliaDate(texto(dados.dataHora, 40));
    if (!Number.isFinite(dataInicio.getTime()) || dataInicio.getTime() <= Date.now()) {
      throw new ErroDeNegocio('Escolha um horário futuro válido.');
    }
    const observacoes = dados.observacoes === undefined ? undefined : texto(dados.observacoes, 4000, true);

    await this.validarAgendamento(
      barbeiro.barbeariaId!,
      dados.barbeiroId,
      dados.clienteId,
      dataInicio,
      duracaoTotal
    );

    return prisma.agendamento.create({
      data: {
        barbeariaId,
        clienteId: dados.clienteId,
        barbeiroId: dados.barbeiroId,
        servicoId: servico.id,
        servicosIds: todosIds,
        dataHora: dataInicio,
        observacoes,
        valorBruto: valorTotal,
        valorCobrado: valorTotal,
        valorLiquido: valorTotal,
        origem,
        status,
        itens: {
          create: todosServicos.map((s, idx) => ({
            servicoId: s.id,
            nome: s.nome,
            preco: Number(s.preco),
            duracaoMinutos: s.duracaoMinutos,
            barbeariaId,
            ordem: idx
          }))
        }
      } as any,
      include: {
        cliente: { include: { usuario: { select: { nome: true } } } },
        barbeiro: { include: { usuario: { select: { nome: true } } } },
        servico: { select: { nome: true, duracaoMinutos: true, cor: true } },
      },
    });
  }

  /** Atualiza status ou dados do agendamento */
  static async atualizar(id: string, entrada: unknown, ator: AtorAgenda) {
    const dados = validarAlteracaoAgendamento(entrada);
    const { formaPagamento, tipoDesconto, pontosUsados, descontoPercentual, descontoReais, ...dadosAgendamento } = dados;
    const escopo = await escopoAgenda(ator);
    const usuarioAcaoId = ator.id;
    const agendamentoOriginal = await prisma.agendamento.findFirst({
      where: { id, ...escopo },
      include: { servico: true, itens: true },
    });
    if (!agendamentoOriginal) throw new ErroDeNegocio('Agendamento não encontrado.', 404);
    if (agendamentoOriginal.status === 'CONCLUIDO') {
      throw new ErroDeNegocio('Este agendamento já foi concluído e não pode ser alterado.', 409);
    }
    const statusOriginal = agendamentoOriginal.status;
    const alteraAgenda = dadosAgendamento.dataHora !== undefined || dadosAgendamento.servicoId !== undefined
      || dadosAgendamento.servicosIds !== undefined || dadosAgendamento.barbeiroId !== undefined;
    if (dadosAgendamento.status === 'CONCLUIDO' && alteraAgenda) {
      throw new ErroDeNegocio('Salve a remarcação antes de concluir o atendimento.');
    }
    if (dadosAgendamento.barbeiroId && escopo.barbeiroId && dadosAgendamento.barbeiroId !== escopo.barbeiroId) {
      throw new ErroDeNegocio('Acesso não autorizado.', 403);
    }
    let novosServicos: Awaited<ReturnType<typeof prisma.servico.findMany>> | undefined;
    if (dadosAgendamento.servicoId !== undefined || dadosAgendamento.servicosIds !== undefined) {
      const ids = dadosAgendamento.servicosIds ?? [dadosAgendamento.servicoId!];
      const principal = dadosAgendamento.servicoId ?? ids[0];
      if (!ids.includes(principal)) throw new ErroDeNegocio('Seleção de serviços inválida.');
      novosServicos = await prisma.servico.findMany({ where: { id: { in: ids }, barbeariaId: escopo.barbeariaId, ativo: true } });
      if (novosServicos.length !== ids.length) throw new ErroDeNegocio('Serviço não disponível nesta barbearia.', 404);
      dadosAgendamento.servicosIds = ids;
      dadosAgendamento.servicoId = principal;
    }
    if (alteraAgenda) {
      const novoBarbeiroId = dadosAgendamento.barbeiroId ?? agendamentoOriginal.barbeiroId;
      const barbeiro = await prisma.barbeiro.findFirst({ where: { id: novoBarbeiroId, barbeariaId: escopo.barbeariaId, ativo: true } });
      if (!barbeiro) throw new ErroDeNegocio('Barbeiro não disponível nesta barbearia.', 404);
      const novaDataHora = dadosAgendamento.dataHora ? toBrasiliaDate(dadosAgendamento.dataHora) : agendamentoOriginal.dataHora;
      if (!Number.isFinite(novaDataHora.getTime()) || (dadosAgendamento.dataHora && novaDataHora.getTime() <= Date.now())) {
        throw new ErroDeNegocio('Escolha um horário futuro válido.');
      }
      const duracao = novosServicos
        ? novosServicos.reduce((total, servico) => total + servico.duracaoMinutos, 0)
        : agendamentoOriginal.itens.length
          ? agendamentoOriginal.itens.reduce((total, item) => total + (item.duracaoMinutos ?? 0), 0)
          : agendamentoOriginal.servico.duracaoMinutos;
      await this.validarAgendamento(escopo.barbeariaId, novoBarbeiroId, agendamentoOriginal.clienteId, novaDataHora, duracao, id);
    }

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
          where: { clienteId: agendamentoOriginal.clienteId, barbeariaId: agendamentoOriginal.barbeariaId },
          _sum: { pontos: true }
        }),
        prisma.resgateRecompensa.aggregate({
          where: { clienteId: agendamentoOriginal.clienteId, barbeariaId: agendamentoOriginal.barbeariaId, status: { in: ['PENDENTE', 'CONFIRMADO'] } },
          _sum: { pontosUsados: true }
        })
      ]);

      if (!configFidelidade) throw new Error('Configuração de fidelidade não encontrada');
      if (!configGlobal) throw new Error('Configuração geral não encontrada');

      const totalGanho = agregacaoPontos._sum.pontos || 0;
      const totalGasto = agregacaoResgates._sum.pontosUsados || 0;
      const saldoPontos = totalGanho - totalGasto;

      // 3. Buscar os preços atuais caso valorBruto seja 0 (Trava do valor zerado)
      let precosServicosAtuais: number[] = [];
      const idsServicos = obterIdsServicosAgendamento(agendamentoOriginal);
      
      let valorBruto = agendamentoOriginal.itens.length
        ? agendamentoOriginal.itens.reduce((total, item) => total + Number(item.preco), 0)
        : Number(agendamentoOriginal.valorBruto || 0);
      if (valorBruto === 0 && !agendamentoOriginal.itens.length) {
        console.warn('financeiro_recalculo_valor_bruto');
        const servicos = await prisma.servico.findMany({
          where: { id: { in: idsServicos } }
        });
        precosServicosAtuais = servicos.map(s => Number(s.preco));
        valorBruto = precosServicosAtuais.reduce((acc, preco) => acc + preco, 0);
        
        if (valorBruto === 0 && servicos.some(s => Number(s.preco) > 0)) {
          throw new Error('O valor calculado dos serviços é 0, mas os serviços não são gratuitos.');
        }
      }

      // 4. Calcular descontos usando DescontoService
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

      // 5. Preparar pontos de acúmulo de fidelidade da visita (FORA DA TRANSAÇÃO)
      // O motor calcula os pontos com base na configuração da barbearia (Bruto ou Líquido)
      const baseParaPontos = configGlobal.baseCalculoPontos === 'VALOR_BRUTO' ? valorBruto : valorFinal;
      const operacoesFidelidade = await prepararOperacoesFidelidade(
        agendamentoOriginal.id,
        agendamentoOriginal.clienteId,
        agendamentoOriginal.barbeariaId!,
        obterIdsServicosAgendamento(agendamentoOriginal),
        baseParaPontos
      );

      // 6. Preparar valores de Comissão
      const comissaoPercent = barbeiro ? (barbeiro.comissaoPercent ?? 0) : 0;
      const baseComissao = configGlobal.baseCalculoComissao === 'VALOR_BRUTO' ? valorBruto : valorFinal;
      const valorComissao = Math.round(baseComissao * comissaoPercent) / 100;
      const valorLiquido = valorFinal - valorComissao;

      // Usar $transaction para garantir atomicidade total
      resultadoFinal = await prisma.$transaction(async (tx) => {
        const claim = await tx.agendamento.updateMany({
          where: { id, ...escopo, status: { not: 'CONCLUIDO' } },
          data: { status: 'CONCLUIDO' },
        });
        if (claim.count !== 1) throw new ErroDeNegocio('Este agendamento já foi concluído.', 409);
        await validarSaldoParaResgate(tx, agendamentoOriginal.clienteId, agendamentoOriginal.barbeariaId!, pontosAUsar);
        // A. Atualiza o agendamento
        const updated = await tx.agendamento.update({
          where: { id, ...escopo },
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
              descricao: `Resgate no atendimento ${agendamentoOriginal.id}`,
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
      }, { isolationLevel: 'Serializable' }).catch(tratarConflitoDeFechamento);

    } else {
      // Se não está concluindo (apenas reagendando, etc), apenas update simples
      const mudouDataBarbeiroServico = 
        (dadosAgendamento.dataHora && toBrasiliaDate(dadosAgendamento.dataHora).getTime() !== agendamentoOriginal.dataHora.getTime()) || 
        (dadosAgendamento.barbeiroId && dadosAgendamento.barbeiroId !== agendamentoOriginal.barbeiroId) ||
        (dadosAgendamento.servicoId && dadosAgendamento.servicoId !== agendamentoOriginal.servicoId) ||
        (dadosAgendamento.servicosIds && JSON.stringify(dadosAgendamento.servicosIds) !== JSON.stringify(obterIdsServicosAgendamento(agendamentoOriginal)));
      
      const payloadUpdate: Prisma.AgendamentoUncheckedUpdateInput = {
        ...dadosAgendamento,
        dataHora: dadosAgendamento.dataHora ? toBrasiliaDate(dadosAgendamento.dataHora) : undefined,
      };

      if (novosServicos) {
        const novoValorBruto = novosServicos.reduce((acc, s) => acc + Number(s.preco), 0);
        // Agendamentos concluídos já são rejeitados na entrada deste método.
        payloadUpdate.valorBruto = novoValorBruto;
        payloadUpdate.valorCobrado = novoValorBruto;
        payloadUpdate.valorLiquido = novoValorBruto;

        payloadUpdate.itens = {
          deleteMany: {},
          create: novosServicos.map((s, idx) => ({
            servicoId: s.id,
            nome: s.nome,
            preco: Number(s.preco),
            duracaoMinutos: s.duracaoMinutos,
            barbeariaId: escopo.barbeariaId,
            ordem: idx
          }))
        };
      }

      if (mudouDataBarbeiroServico && !payloadUpdate.status) {
        payloadUpdate.status = 'AGUARDANDO';
      }

      resultadoFinal = await prisma.$transaction(async (tx) => {
        const claim = await tx.agendamento.updateMany({
          where: { id, ...escopo, status: { not: 'CONCLUIDO' } },
          data: { status: statusOriginal },
        });
        if (claim.count !== 1) throw new ErroDeNegocio('Este agendamento não pode mais ser alterado.', 409);
        const agUpdated = await tx.agendamento.update({
          where: { id, ...escopo },
          data: payloadUpdate,
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
              barbeariaId: escopo.barbeariaId,
              dataHoraAnterior: agendamentoOriginal.dataHora,
              dataHoraNova: dadosAgendamento.dataHora ? toBrasiliaDate(dadosAgendamento.dataHora) : agendamentoOriginal.dataHora,
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
  static async cancelar(id: string, ator: AtorAgenda) {
    return this.atualizar(id, { status: 'CANCELADO' }, ator);
  }

  /** Retorna horários livres e ocupados de um barbeiro em uma data */
  static async horariosDisponivies(barbeiroId: string, data: string, ator: AtorAgenda) {
    const escopo = await escopoAgenda(ator);
    if (escopo.barbeiroId && escopo.barbeiroId !== barbeiroId) throw new ErroDeNegocio('Acesso não autorizado.', 403);
    const barbeiro = await prisma.barbeiro.findFirst({
      where: { id: texto(barbeiroId), barbeariaId: escopo.barbeariaId }, include: { barbearia: true },
    });
    if (!barbeiro) throw new ErroDeNegocio('Barbeiro não encontrado.', 404);
    const inicio = inicioDiaBrasilia(data);
    const fim = fimDiaBrasilia(data);

    // Busca agendamentos do dia (exceto cancelados)
    const agendamentos = await prisma.agendamento.findMany({
      where: {
        barbeiroId,
        barbeariaId: escopo.barbeariaId,
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
        barbeiro: { barbeariaId: escopo.barbeariaId },
        dataInicio: { lte: fim },
        dataFim: { gte: inicio },
      }
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
    ator: AtorAgenda,
    tipoDesconto: TipoDesconto,
    descontoReais: number = 0,
    descontoPercentual: number = 0,
    pontosUsados: number = 0
  ) {
    const escopo = await escopoAgenda(ator);
    const agendamento = await prisma.agendamento.findFirst({
      where: { id: agendamentoId, ...escopo },
      include: { itens: true, cliente: { select: { dataNascimento: true } } },
    });

    if (!agendamento) throw new ErroDeNegocio('Agendamento não encontrado.', 404);

    const [configFidelidade, configGlobal, barbeiro, agregacaoPontos, agregacaoResgates] = await Promise.all([
      prisma.configuracaoFidelidade.findUnique({
        where: { barbeariaId: agendamento.barbeariaId! },
      }),
      prisma.configuracao.findUnique({
        where: { barbeariaId: agendamento.barbeariaId! },
      }),
      prisma.barbeiro.findUnique({
        where: { id: agendamento.barbeiroId },
        select: { comissaoPercent: true }
      }),
      prisma.pontoFidelidade.aggregate({
        where: { clienteId: agendamento.clienteId, barbeariaId: agendamento.barbeariaId },
        _sum: { pontos: true }
      }),
      prisma.resgateRecompensa.aggregate({
        where: { clienteId: agendamento.clienteId, barbeariaId: agendamento.barbeariaId, status: { in: ['PENDENTE', 'CONFIRMADO'] } },
        _sum: { pontosUsados: true }
      })
    ]);

    if (!configFidelidade) throw new Error('Configuração de fidelidade não encontrada');
    if (!configGlobal) throw new Error('Configuração geral não encontrada');

    const totalGanho = agregacaoPontos._sum.pontos || 0;
    const totalGasto = agregacaoResgates._sum.pontosUsados || 0;
    const saldoPontos = totalGanho - totalGasto;

    let precosServicosAtuais: number[] = [];
      const idsServicos = obterIdsServicosAgendamento(agendamento);
      const servicos = await prisma.servico.findMany({
        where: { id: { in: idsServicos } }
      });
      precosServicosAtuais = servicos.map(s => Number(s.preco));
      
      const valorCalc = precosServicosAtuais.reduce((a, b) => a + b, 0);
      if (valorCalc === 0 && servicos.some(s => Number(s.preco) > 0)) {
        throw new Error('O valor calculado dos serviços é 0, mas os serviços não são gratuitos.');
      }


    const { calcularFechamento } = await import('../utils/financeiro.util');
    
    return calcularFechamento({
      servicosIds: obterIdsServicosAgendamento(agendamento),
      temCliente: Boolean(agendamento.clienteId),
      dataNascimento: agendamento.cliente.dataNascimento,
      valorBrutoOriginal: agendamento.itens.length
        ? agendamento.itens.reduce((total, item) => total + Number(item.preco), 0)
        : Number(agendamento.valorBruto || 0),
      precosServicosAtuais: agendamento.itens.length ? agendamento.itens.map(item => Number(item.preco)) : precosServicosAtuais,
      tipoDesconto,
      valorDescontoReais: descontoReais,
      valorDescontoPercentual: descontoPercentual,
      pontosUsados,
      saldoPontos,
      configFidelidade: {
        ativo: configFidelidade.ativo,
        regrasPorServico: configFidelidade.regrasPorServico,
        pontosDobroAniversario: configFidelidade.pontosDobroAniversario,
        resgatePontosAtivo: configFidelidade.resgatePontosAtivo ?? false,
        valorPorPonto: Number(configFidelidade.valorPorPonto),
        percentualMaxPontos: Number(configFidelidade.percentualMaxPontos),
        descontoMaxReais: Number(configFidelidade.descontoMaxReais),
        descontoMaxPercentual: Number(configFidelidade.descontoMaxPercentual),
        permitirCombinarDescontos: configFidelidade.permitirCombinarDescontos ?? false,
        pontosPorReal: Number(configFidelidade.pontosPorReal || 0),
        pontosPorVisita: Number(configFidelidade.pontosPorVisita || 0)
      },
      configGlobal: {
        baseCalculoComissao: configGlobal.baseCalculoComissao,
        baseCalculoPontos: configGlobal.baseCalculoPontos
      },
      percentualComissao: barbeiro ? (barbeiro.comissaoPercent ?? 0) : 0
    });
  }
}
