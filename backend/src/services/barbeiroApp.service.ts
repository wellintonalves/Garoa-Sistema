// Serviço do app do barbeiro — login, agenda, comissões, conclusão de atendimentos
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { authConfig } from '../config/auth';
import { BarbeiroJWT } from '../types';
import { diaBrasiliaStr, inicioDiaBrasilia, fimDiaBrasilia } from '../lib/timezone';

interface RespostaAuthBarbeiro {
  token: string;
  barbeiro: BarbeiroJWT;
}

export class BarbeiroAppService {
  /** Login do barbeiro */
  static async login(email: string, senha: string): Promise<RespostaAuthBarbeiro> {
    const usuario = await prisma.usuario.findFirst({
      where: { email, papel: 'BARBEIRO' },
      include: { barbeiro: true },
    });

    if (!usuario || !usuario.barbeiro) {
      throw new Error('Email ou senha incorretos');
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      throw new Error('Email ou senha incorretos');
    }

    if (!usuario.barbeiro.ativo) {
      throw new Error('Conta de barbeiro desativada');
    }

    const payload: BarbeiroJWT = {
      barbeiroId: usuario.barbeiro.id,
      usuarioId: usuario.id,
      barbeariaId: usuario.barbeiro.barbeariaId as string,
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
    formaPagamento: string
  ) {
    const agendamento = await prisma.agendamento.findUnique({
      where: { id: agendamentoId },
      include: { servico: true },
    });

    if (!agendamento) throw new Error('Agendamento não encontrado');
    if (agendamento.barbeiroId !== barbeiroId) throw new Error('Este agendamento não pertence a você');
    if (agendamento.status === 'CONCLUIDO') throw new Error('Agendamento já foi concluído');

    // Atualiza status
    await prisma.agendamento.update({
      where: { id: agendamentoId },
      data: { status: 'CONCLUIDO' },
    });

    // Calcula comissão
    const barbeiro = await prisma.barbeiro.findUnique({
      where: { id: barbeiroId },
      select: { comissaoPercent: true },
    });

    const valor = Number(agendamento.valorCobrado);
    const comissaoPercent = barbeiro?.comissaoPercent || 50;
    const valorComissao = (valor * comissaoPercent) / 100;
    const valorLiquido = valor - valorComissao;

    // Cria lançamento financeiro
    const lancamento = await prisma.lancamentoFinanceiro.create({
      data: {
        barbeariaId: agendamento.barbeariaId || barbeariaId,
        tipo: 'ENTRADA',
        categoria: 'Serviço',
        descricao: `${agendamento.servico.nome} — concluído pelo barbeiro`,
        valor: agendamento.valorCobrado,
        formaPagamento: formaPagamento as 'DINHEIRO' | 'PIX' | 'CARTAO_DEBITO' | 'CARTAO_CREDITO',
        agendamentoId,
        barbeiroId,
        servicoId: agendamento.servicoId,
        valorComissao,
        valorLiquido,
        data: new Date(),
      },
    });

    return { agendamento: { ...agendamento, status: 'CONCLUIDO' }, lancamento };
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
}
