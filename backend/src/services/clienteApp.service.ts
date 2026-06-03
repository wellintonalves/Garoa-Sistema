// Serviço do app do cliente — autenticação, barbearias, agendamentos, fidelidade
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { authConfig } from '../config/auth';
import { ClienteJWT } from '../types';
import {
  toBrasiliaDate,
  inicioDiaBrasilia,
  fimDiaBrasilia,
  getHoraMinutoBrasilia,
  criarDataHoraBrasilia,
  formatarHorario,
} from '../lib/timezone';

interface DadosCadastroCliente {
  nome: string;
  email: string;
  senha: string;
  telefone?: string;
}

interface RespostaAuthCliente {
  token: string;
  cliente: ClienteJWT;
}

export class ClienteAppService {
  /** Cadastro global de cliente (sem barbearia fixa) */
  static async registrar(dados: DadosCadastroCliente): Promise<RespostaAuthCliente> {
    // Verifica se email já existe como cliente global (barbeariaId null)
    const existente = await prisma.usuario.findFirst({
      where: { email: dados.email, barbeariaId: null, papel: 'CLIENTE' },
    });

    if (existente) {
      throw new Error('Este email já está cadastrado');
    }

    const senhaHash = await bcrypt.hash(dados.senha, authConfig.saltRounds);

    // Cria usuario global (sem barbeariaId)
    const usuario = await prisma.usuario.create({
      data: {
        nome: dados.nome,
        email: dados.email,
        senha: senhaHash,
        papel: 'CLIENTE',
        barbeariaId: null,
      },
    });

    // Cria registro de cliente
    const cliente = await prisma.cliente.create({
      data: {
        usuarioId: usuario.id,
        barbeariaId: null,
        telefone: dados.telefone || null,
      },
    });

    const payload: ClienteJWT = {
      clienteId: cliente.id,
      usuarioId: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
    };

    const token = jwt.sign(
      { ...payload },
      authConfig.secretCliente as jwt.Secret,
      { expiresIn: authConfig.expiresIn } as jwt.SignOptions
    );

    return { token, cliente: payload };
  }

  /** Login do cliente */
  static async login(email: string, senha: string): Promise<RespostaAuthCliente> {
    const usuario = await prisma.usuario.findFirst({
      where: { email, papel: 'CLIENTE', barbeariaId: null },
      include: { cliente: true },
    });

    if (!usuario || !usuario.cliente) {
      throw new Error('Email ou senha incorretos');
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      throw new Error('Email ou senha incorretos');
    }

    const payload: ClienteJWT = {
      clienteId: usuario.cliente.id,
      usuarioId: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
    };

    const token = jwt.sign(
      { ...payload },
      authConfig.secretCliente as jwt.Secret,
      { expiresIn: authConfig.expiresIn } as jwt.SignOptions
    );

    return { token, cliente: payload };
  }

  /** Busca barbearias pelo nome */
  static async buscarBarbearias(nome: string) {
    return prisma.barbearia.findMany({
      where: {
        nome: { contains: nome, mode: 'insensitive' },
        ativo: true,
      },
      select: {
        id: true,
        nome: true,
        slug: true,
        logo: true,
        endereco: true,
        telefone: true,
      },
      take: 20,
    });
  }

  /** Busca barbearia por slug */
  static async buscarBarbeariaPorSlug(slug: string) {
    const barbearia = await prisma.barbearia.findUnique({
      where: { slug },
      select: {
        id: true,
        nome: true,
        slug: true,
        logo: true,
        endereco: true,
        telefone: true,
      },
    });
    if (!barbearia) throw new Error('Barbearia não encontrada');
    return barbearia;
  }

  /** Conecta cliente a uma barbearia */
  static async conectarBarbearia(clienteId: string, barbeariaId: string) {
    // Verifica se barbearia existe
    const barbearia = await prisma.barbearia.findUnique({ where: { id: barbeariaId } });
    if (!barbearia || !barbearia.ativo) {
      throw new Error('Barbearia não encontrada');
    }

    // Cria conexão (ou ignora se já existe)
    const existente = await prisma.clienteBarbearia.findUnique({
      where: { clienteId_barbeariaId: { clienteId, barbeariaId } },
    });

    if (existente) {
      return existente;
    }

    return prisma.clienteBarbearia.create({
      data: { clienteId, barbeariaId },
    });
  }

  /** Desconecta cliente de uma barbearia */
  static async desconectarBarbearia(clienteId: string, barbeariaId: string) {
    return prisma.clienteBarbearia.deleteMany({
      where: { clienteId, barbeariaId },
    });
  }

  /** Lista barbearias conectadas ao cliente */
  static async minhasBarbearias(clienteId: string) {
    const conexoes = await prisma.clienteBarbearia.findMany({
      where: { clienteId },
      include: {
        barbearia: {
          select: {
            id: true,
            nome: true,
            slug: true,
            logo: true,
            endereco: true,
            telefone: true,
          },
        },
      },
      orderBy: { conectadoEm: 'desc' },
    });

    return conexoes.map((c) => ({
      ...c.barbearia,
      conectadoEm: c.conectadoEm,
    }));
  }

  /** Dados do perfil do cliente */
  static async perfil(clienteId: string) {
    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
      include: {
        usuario: {
          select: { id: true, nome: true, email: true },
        },
      },
    });
    if (!cliente) throw new Error('Cliente não encontrado');
    return cliente;
  }

  /** Atualiza perfil do cliente */
  static async atualizarPerfil(clienteId: string, dados: { nome?: string; telefone?: string }) {
    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
    });
    if (!cliente) throw new Error('Cliente não encontrado');

    if (dados.nome) {
      await prisma.usuario.update({
        where: { id: cliente.usuarioId },
        data: { nome: dados.nome },
      });
    }

    if (dados.telefone !== undefined) {
      await prisma.cliente.update({
        where: { id: clienteId },
        data: { telefone: dados.telefone },
      });
    }

    return this.perfil(clienteId);
  }

  /** Agendamentos do cliente em uma barbearia */
  static async agendamentos(clienteId: string, barbeariaId: string) {
    return prisma.agendamento.findMany({
      where: { clienteId, barbeariaId },
      include: {
        barbeiro: { include: { usuario: { select: { nome: true } } } },
        servico: { select: { nome: true, preco: true, duracaoMinutos: true } },
      },
      orderBy: { dataHora: 'desc' },
    });
  }

  /** Serviços de uma barbearia */
  static async servicos(barbeariaId: string) {
    // Auto-correção: caso algum serviço esteja órfão, vincula à barbearia atual
    await prisma.servico.updateMany({
      where: { barbeariaId: null },
      data: { barbeariaId }
    });

    return prisma.servico.findMany({
      where: { barbeariaId, ativo: true },
      orderBy: { nome: 'asc' },
    });
  }

  /** Barbeiros de uma barbearia */
  static async barbeiros(barbeariaId: string) {
    // Auto-correção: caso algum barbeiro esteja órfão, vincula à barbearia atual
    await prisma.barbeiro.updateMany({
      where: { barbeariaId: null },
      data: { barbeariaId }
    });
    
    // Atualiza o usuário atrelado ao barbeiro órfão se necessário
    const barbeirosOrfaos = await prisma.barbeiro.findMany({
      where: { barbeariaId },
      select: { usuarioId: true }
    });
    if (barbeirosOrfaos.length > 0) {
      const usuarioIds = barbeirosOrfaos.map(b => b.usuarioId);
      await prisma.usuario.updateMany({
        where: { id: { in: usuarioIds }, barbeariaId: null },
        data: { barbeariaId }
      });
    }

    return prisma.barbeiro.findMany({
      where: { barbeariaId, ativo: true },
      include: { usuario: { select: { nome: true } } },
    });
  }

  /** Horários disponíveis */
  static async horariosDisponiveis(barbeariaId: string, barbeiroId: string, data: string, servicoId: string) {
    const servico = await prisma.servico.findUnique({ where: { id: servicoId } });
    if (!servico) throw new Error('Serviço não encontrado');

    const barbearia = await prisma.barbearia.findUnique({ where: { id: barbeariaId } });
    if (!barbearia) throw new Error('Barbearia não encontrada');

    const inicio = inicioDiaBrasilia(data);
    const fim = fimDiaBrasilia(data);

    const agendamentos = await prisma.agendamento.findMany({
      where: {
        barbeiroId,
        barbeariaId,
        dataHora: { gte: inicio, lte: fim },
        status: { not: 'CANCELADO' },
      },
      include: { servico: { select: { duracaoMinutos: true } } },
      orderBy: { dataHora: 'asc' },
    });

    const horaAbertura = parseInt(barbearia.horarioAbertura?.split(':')[0] || '9');
    const minAbertura = parseInt(barbearia.horarioAbertura?.split(':')[1] || '0');
    const horaFechamento = parseInt(barbearia.horarioFechamento?.split(':')[0] || '19');
    const minFechamento = parseInt(barbearia.horarioFechamento?.split(':')[1] || '0');
    const duracaoServico = servico.duracaoMinutos;

    // Horário de almoço
    const temAlmoco = barbearia.temAlmoco || false;
    const almocoInicio = barbearia.horarioAlmocoInicio || '12:00';
    const almocoFim = barbearia.horarioAlmocoFim || '13:00';
    const almocoInicioMin = parseInt(almocoInicio.split(':')[0]) * 60 + parseInt(almocoInicio.split(':')[1]);
    const almocoFimMin = parseInt(almocoFim.split(':')[0]) * 60 + parseInt(almocoFim.split(':')[1]);

    const inicioMin = horaAbertura * 60 + minAbertura;
    const fimMin = horaFechamento * 60 + minFechamento;

    const slots: Array<{ horario: string; disponivel: boolean }> = [];

    for (let m = inicioMin; m < fimMin; m += 30) {
      const hora = Math.floor(m / 60);
      const minuto = m % 60;

      // Pula horário de almoço
      if (temAlmoco && m >= almocoInicioMin && m < almocoFimMin) {
        continue;
      }

      const slotInicio = criarDataHoraBrasilia(data, hora, minuto);
      const slotFim = new Date(slotInicio.getTime() + duracaoServico * 60000);

      // Verifica conflito
      const conflito = agendamentos.some((ag) => {
        const agInicio = new Date(ag.dataHora);
        const agFim = new Date(agInicio.getTime() + ag.servico.duracaoMinutos * 60000);
        return slotInicio < agFim && slotFim > agInicio;
      });

      slots.push({
        horario: formatarHorario(hora, minuto),
        disponivel: !conflito,
      });
    }

    return slots;
  }

  /** Cria agendamento pelo cliente */
  static async agendar(clienteId: string, barbeariaId: string, dados: {
    barbeiroId: string;
    servicoId: string;
    data: string;
    hora: string;
    observacoes?: string;
  }) {
    const servico = await prisma.servico.findUnique({ where: { id: dados.servicoId } });
    if (!servico) throw new Error('Serviço não encontrado');

    const dataHora = toBrasiliaDate(`${dados.data}T${dados.hora}:00`);

    const agendamento = await prisma.agendamento.create({
      data: {
        barbeariaId,
        clienteId,
        barbeiroId: dados.barbeiroId,
        servicoId: dados.servicoId,
        dataHora,
        valorCobrado: servico.preco,
        origem: 'APP_CLIENTE',
        observacoes: dados.observacoes,
      },
    });

    // Adiciona pontos de fidelidade (10 pontos por agendamento)
    await prisma.pontoFidelidade.create({
      data: {
        clienteId,
        barbeariaId,
        pontos: 10,
        descricao: `Agendamento: ${servico.nome}`,
      },
    });

    return agendamento;
  }

  /** Fidelidade do cliente em uma barbearia */
  static async fidelidade(clienteId: string, barbeariaId: string) {
    const pontos = await prisma.pontoFidelidade.findMany({
      where: { clienteId, barbeariaId },
      orderBy: { data: 'desc' },
    });

    const totalPontos = pontos.reduce((acc, p) => acc + p.pontos, 0);

    // Configuração padrão: 100 pontos = 1 recompensa
    const pontosParaRecompensa = 100;
    const progresso = (totalPontos % pontosParaRecompensa) / pontosParaRecompensa * 100;
    const recompensasResgatadas = Math.floor(totalPontos / pontosParaRecompensa);

    return {
      totalPontos,
      pontosParaRecompensa,
      progresso,
      recompensasResgatadas,
      historico: pontos.map((p) => ({
        id: p.id,
        pontos: p.pontos,
        descricao: p.descricao,
        data: p.data,
      })),
    };
  }
}
