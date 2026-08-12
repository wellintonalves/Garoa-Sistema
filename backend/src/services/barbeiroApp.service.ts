// Serviço do app do barbeiro — login, agenda, comissões, conclusão de atendimentos
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { authConfig } from '../config/auth';
import { BarbeiroJWT } from '../types';
import { diaBrasiliaStr, inicioDiaBrasilia, fimDiaBrasilia } from '../lib/timezone';
import { prepararOperacoesFidelidade, creditarPontosPorAgendamento } from './fidelidade.engine';
import { FormaPagamento } from '@prisma/client';
import { DescontoService, TipoDesconto } from './desconto.service';

interface RespostaAuthBarbeiro {
  token: string;
  barbeiro: BarbeiroJWT;
}

export class BarbeiroAppService {
  /** Login do barbeiro — resolve colisão de email entre barbearias */
  static async login(email: string, senha: string, barbeariaId?: string): Promise<RespostaAuthBarbeiro> {
    const emailNormalizado = String(email).trim().toLowerCase();

    // Busca TODOS os usuários barbeiro com esse email (pode haver 1 por barbearia)
    const candidatos = await prisma.usuario.findMany({
      where: {
        email: { equals: emailNormalizado, mode: 'insensitive' },
        papel: 'BARBEIRO',
        ...(barbeariaId ? { barbeariaId } : {}),
      },
      include: {
        barbeiro: {
          include: { barbearia: { select: { id: true, nome: true, slug: true } } },
        },
      },
    });

    const comBarbeiro = candidatos.filter((u) => u.barbeiro !== null);
    if (comBarbeiro.length === 0) {
      throw new Error('Email ou senha incorretos');
    }

    // Testa a senha contra CADA candidato — não assume que o primeiro é o certo
    const combinam: typeof comBarbeiro = [];
    for (const u of comBarbeiro) {
      if (await bcrypt.compare(senha, u.senha)) combinam.push(u);
    }

    if (combinam.length === 0) {
      throw new Error('Email ou senha incorretos');
    }

    const ativos = combinam.filter((u) => u.barbeiro!.ativo);

    // Só reporta "desativada" se a senha bateu e TODAS as contas estão inativas
    if (ativos.length === 0) {
      throw new Error('Conta de barbeiro desativada');
    }

    // Ambiguidade real: mesmo email + mesma senha em mais de uma barbearia ativa
    if (ativos.length > 1) {
      const erro: any = new Error('Selecione a barbearia para continuar');
      erro.codigo = 'ESCOLHER_BARBEARIA';
      erro.barbearias = ativos.map((u) => ({
        id: u.barbeiro!.barbearia?.id,
        nome: u.barbeiro!.barbearia?.nome,
        slug: u.barbeiro!.barbearia?.slug,
      }));
      throw erro;
    }

    const usuario = ativos[0];

    const payload: BarbeiroJWT = {
      barbeiroId: usuario.barbeiro!.id,
      usuarioId: usuario.id,
      barbeariaId: usuario.barbeiro!.barbeariaId as string,
      nome: usuario.nome,
      email: usuario.email,
    };

    const token = jwt.sign(
      { ...payload },
      authConfig.secretBarbeiro as jwt.Secret,
      { expiresIn: authConfig.expiresIn } as jwt.SignOptions
    );

    return { token, barbeiro: payload };
  }

  /** Agendamentos do barbeiro hoje */
  static async agendaHoje(barbeiroId: string, barbeariaId: string) {
    const hojeStr = diaBrasiliaStr();
    const hoje = inicioDiaBrasilia(hojeStr);
    const amanha = fimDiaBrasilia(hojeStr);

    return prisma.agendamento.findMany({
      where: {
        barbeiroId,
        barbeariaId,
        dataHora: { gte: hoje, lte: amanha },
        status: { not: 'CANCELADO' },
      },
      include: {
        cliente: { include: { usuario: { select: { nome: true } } } },
        servico: { select: { nome: true, preco: true, duracaoMinutos: true } },
      },
      orderBy: { dataHora: 'asc' },
    });
  }

  /** Agendamentos do barbeiro por data */
  static async agendaPorData(barbeiroId: string, barbeariaId: string, data: string) {
    const inicio = inicioDiaBrasilia(data);
    const fim = fimDiaBrasilia(data);

    return prisma.agendamento.findMany({
      where: {
        barbeiroId,
        barbeariaId,
        dataHora: { gte: inicio, lte: fim },
        status: { not: 'CANCELADO' },
      },
      include: {
        cliente: { include: { usuario: { select: { nome: true } } } },
        servico: { select: { nome: true, preco: true, duracaoMinutos: true } },
      },
      orderBy: { dataHora: 'asc' },
    });
  }

  /** Comissões do barbeiro no período */
  static async comissoes(barbeiroId: string, barbeariaId: string, inicio: string, fim: string) {
    const dataInicio = inicioDiaBrasilia(inicio);
    const dataFim = fimDiaBrasilia(fim);

    const lancamentos = await prisma.lancamentoFinanceiro.findMany({
      where: {
        barbeiroId,
        barbeariaId,
        tipo: 'ENTRADA',
        data: { gte: dataInicio, lte: dataFim },
      },
      include: {
        servico: { select: { nome: true } },
        agendamento: {
          include: {
            cliente: { include: { usuario: { select: { nome: true } } } },
          },
        },
      },
      orderBy: { data: 'desc' },
    });

    const barbeiro = await prisma.barbeiro.findUnique({
      where: { id: barbeiroId },
      select: { comissaoPercent: true },
    });

    const totalAtendimentos = lancamentos.length;
    const valorBruto = lancamentos.reduce((acc, l) => acc + Number(l.valor), 0);
    const percentualComissao = barbeiro?.comissaoPercent || 50;
    const valorComissao = lancamentos.reduce((acc, l) => acc + Number(l.valorComissao || 0), 0);

    return {
      totalAtendimentos,
      valorBruto,
      percentualComissao,
      valorComissao,
      lancamentos: lancamentos.map((l) => ({
        id: l.id,
        data: l.data,
        valor: Number(l.valor),
        valorComissao: Number(l.valorComissao || 0),
        servico: l.servico?.nome || 'Serviço',
        cliente: l.agendamento?.cliente?.usuario?.nome || 'Cliente',
      })),
    };
  }

  /** Conclui atendimento e gera lançamento financeiro */
  static async concluirAgendamento(
    agendamentoId: string,
    barbeiroId: string,
    barbeariaId: string,
    formaPagamento: string,
    valorCobrado?: number, // Este valorCobrado pode vir do frontend do barbeiro (ainda não atualizado, então aceitamos mas recalculamos se tiver pontos ou descontos)
    pontosUsados?: number,
    descontoPercentual?: number,
    descontoReais?: number
  ) {
    const agendamentoOriginal = await prisma.agendamento.findUnique({
      where: { id: agendamentoId },
      include: { servico: true },
    });

    if (!agendamentoOriginal) {
      const error: any = new Error('Agendamento não encontrado');
      error.status = 404;
      throw error;
    }
    if (agendamentoOriginal.barbeiroId !== barbeiroId) {
      const error: any = new Error('Este agendamento não pertence a você');
      error.status = 403;
      throw error;
    }
    if (agendamentoOriginal.status === 'CONCLUIDO') {
      const error: any = new Error('Agendamento já foi concluído');
      error.status = 409;
      throw error;
    }

    // 1. Validar forma de pagamento
    const formasPermitidas = Object.values(FormaPagamento);
    if (!formasPermitidas.includes(formaPagamento as FormaPagamento)) {
      const error: any = new Error('Forma de pagamento inválida.');
      error.status = 400;
      throw error;
    }

    // 2. Buscar configuração de fidelidade, configuração global, barbeiro e saldo
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
    let valorBruto = Number(agendamentoOriginal.servico.preco);
    if (valorCobrado !== undefined && !descontoPercentual && !descontoReais && !pontosUsados) {
      valorBruto = valorCobrado;
    }
    
    let tipoDesconto: TipoDesconto = 'NENHUM';
    if (pontosUsados && pontosUsados > 0) tipoDesconto = 'PONTOS';
    else if (descontoReais && descontoReais > 0) tipoDesconto = 'REAIS';
    else if (descontoPercentual && descontoPercentual > 0) tipoDesconto = 'PERCENTUAL';

    const resultadoDesconto = DescontoService.calcularDesconto({
      valorBruto,
      tipo: tipoDesconto,
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

    // 4. Preparar pontos de acúmulo de fidelidade da visita
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

    // Usar $transaction
    const resultadoFinal = await prisma.$transaction(async (tx) => {
      // A. Atualiza agendamento
      const updated = await tx.agendamento.update({
        where: { id: agendamentoId },
        data: { 
          status: 'CONCLUIDO',
          valorCobrado: valorFinal,
          tipoDesconto,
          descontoPercentualAplic: descontoPercentual ? Number(descontoPercentual) : null,
          descontoManual: descontoReais ? Number(descontoReais) : 0,
          descontoPontos: Number(resultadoDesconto.descontoPontos),
          pontosUtilizados: pontosAUsar,
          valorBruto: Number(resultadoDesconto.valorBruto),
          valorDesconto: Number(resultadoDesconto.valorDesconto),
          valorLiquido: Number(resultadoDesconto.valorLiquido),
        } as any,
      });

      // B. Debita pontos (se usou)
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

      // C. Lançamento financeiro
      await tx.lancamentoFinanceiro.create({
        data: {
          barbeariaId: agendamentoOriginal.barbeariaId || barbeiro?.barbeariaId || '',
          tipo: 'ENTRADA',
          categoria: 'Serviço',
          descricao: `${agendamentoOriginal.servico.nome} — concluído pelo app do barbeiro`,
          valor: valorFinal,
          formaPagamento: (formaPagamento as FormaPagamento) || 'PIX',
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

      return {
        message: 'Agendamento concluído com sucesso',
        agendamento: updated
      };
    });

    // Credita pontos de fidelidade ganhos
    await creditarPontosPorAgendamento(agendamentoId);

    return resultadoFinal;
  }

  /** Perfil do barbeiro */
  static async perfil(barbeiroId: string) {
    const barbeiro = await prisma.barbeiro.findUnique({
      where: { id: barbeiroId },
      include: {
        usuario: { select: { nome: true, email: true } },
        barbearia: { select: { nome: true, slug: true, logo: true } },
      },
    });
    if (!barbeiro) throw new Error('Barbeiro não encontrado');
    return barbeiro;
  }

  /** Atualizar Perfil do Barbeiro */
  static async atualizarPerfil(
    barbeiroId: string, 
    dados: { nome?: string; telefone?: string; especialidades?: string[]; foto?: string; horariosTrabalho?: any }
  ) {
    const barbeiro = await prisma.barbeiro.findUnique({ where: { id: barbeiroId } });
    if (!barbeiro) throw new Error('Barbeiro não encontrado');

    const updateBarbeiroData: any = {};
    if (dados.telefone !== undefined) updateBarbeiroData.telefone = dados.telefone;
    if (dados.especialidades !== undefined) updateBarbeiroData.especialidades = dados.especialidades;
    if (dados.foto !== undefined) updateBarbeiroData.foto = dados.foto;
    if (dados.horariosTrabalho !== undefined) updateBarbeiroData.horariosTrabalho = dados.horariosTrabalho;

    const [atualizado] = await prisma.$transaction([
      prisma.barbeiro.update({
        where: { id: barbeiroId },
        data: updateBarbeiroData,
        include: {
          usuario: { select: { nome: true, email: true } },
          barbearia: { select: { nome: true, slug: true, logo: true } },
        }
      }),
      ...(dados.nome ? [
        prisma.usuario.update({
          where: { id: barbeiro.usuarioId },
          data: { nome: dados.nome }
        })
      ] : [])
    ]);

    // O retorno da transaction já tem o nome atualizado caso tenha sido editado
    if (dados.nome) atualizado.usuario.nome = dados.nome;

    return atualizado;
  }

  /** Resumo da semana (últimos 7 dias) */
  static async resumoSemana(barbeiroId: string, barbeariaId: string) {
    const hojeStr = diaBrasiliaStr();
    const dataFim = fimDiaBrasilia(hojeStr);
    
    const hoje = new Date(hojeStr + 'T12:00:00-03:00');
    hoje.setDate(hoje.getDate() - 6);
    const dataInicio = inicioDiaBrasilia(hoje.toISOString().split('T')[0]);

    const agendamentos = await prisma.agendamento.findMany({
      where: {
        barbeiroId,
        barbeariaId,
        dataHora: { gte: dataInicio, lte: dataFim },
        status: { in: ['CONCLUIDO', 'CONFIRMADO', 'AGUARDANDO'] },
      },
      select: { dataHora: true }
    });

    const porDia: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(hoje);
      d.setDate(d.getDate() + i);
      const str = d.toISOString().split('T')[0];
      porDia[str] = 0;
    }

    for (const ag of agendamentos) {
      const dataStr = diaBrasiliaStr(ag.dataHora);
      if (porDia[dataStr] !== undefined) {
        porDia[dataStr]++;
      }
    }

    return Object.keys(porDia).map(data => ({ data, atendimentos: porDia[data] }));
  }
}
