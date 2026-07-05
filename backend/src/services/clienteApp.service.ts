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
  isNovo?: boolean;
}

export class ClienteAppService {
  /** Cadastro global de cliente (sem barbearia fixa) */
  static async registrar(dados: DadosCadastroCliente): Promise<RespostaAuthCliente> {
    // Bônus: Limpeza automática de registros pendentes antigos (> 24h)
    const dataLimite = new Date(Date.now() - 24 * 60 * 60 * 1000);
    try {
      await prisma.usuario.deleteMany({
        where: {
          papel: 'CLIENTE',
          emailVerificado: false,
          createdAt: { lt: dataLimite },
        },
      });
    } catch (e) {
      console.error('[Registro Cliente] Erro na limpeza de pendentes antigos:', e);
    }
    // Verifica se email já existe como cliente global (barbeariaId null)
    const existente = await prisma.usuario.findFirst({
      where: { email: dados.email, barbeariaId: null, papel: 'CLIENTE' },
      include: { cliente: true }
    });

    if (existente) {
      if (existente.emailVerificado) {
        throw new Error('Este email já está cadastrado');
      } else {
        // Atualiza a senha e dados do usuário existente não verificado
        const senhaHash = await bcrypt.hash(dados.senha, authConfig.saltRounds);
        await prisma.usuario.update({
          where: { id: existente.id },
          data: { nome: dados.nome, senha: senhaHash }
        });

        if (dados.telefone && existente.cliente) {
          await prisma.cliente.update({
            where: { id: existente.cliente.id },
            data: { telefone: dados.telefone }
          });
        }

        const payload: ClienteJWT = {
          clienteId: existente.cliente!.id,
          usuarioId: existente.id,
          nome: dados.nome,
          email: existente.email,
        };

        const token = jwt.sign(
          { ...payload },
          authConfig.secretCliente as jwt.Secret,
          { expiresIn: authConfig.expiresIn } as jwt.SignOptions
        );

        return { token, cliente: payload, isNovo: false };
      }
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

    return { token, cliente: payload, isNovo: true };
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

    if (!usuario.emailVerificado) {
      throw new Error('Email não verificado');
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

  /** Conecta cliente a uma barbearia (opcionalmente com código de indicação) */
  static async conectarBarbearia(clienteId: string, barbeariaId: string, codigoIndicacao?: string) {
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

    const conexao = await prisma.clienteBarbearia.create({
      data: { clienteId, barbeariaId },
    });

    // Processamento pós-conexão: boas-vindas e indicação
    try {
      const config = await prisma.configuracaoFidelidade.findUnique({ where: { barbeariaId } });

      if (config && config.ativo) {
        // Pontos de boas-vindas para o novo cliente
        const pontosBoasVindas = (config as any).pontosBoasVindas as number ?? 0;
        if (pontosBoasVindas > 0) {
          try {
            await prisma.$transaction([
              (prisma as any).boasVindasConcedida.create({
                data: { clienteId, barbeariaId }
              }),
              prisma.pontoFidelidade.create({
                data: {
                  clienteId,
                  barbeariaId,
                  pontos: pontosBoasVindas,
                  descricao: 'Bem-vindo! Pontos de boas-vindas',
                },
              })
            ]);
          } catch (e: any) {
            if (e.code !== 'P2002') {
              console.error('[conectarBarbearia] Erro ao creditar boas-vindas:', e);
            }
          }
        }

        // Processa código de indicação
        if (codigoIndicacao) {
          const indicador = await prisma.cliente.findUnique({
            where: { codigoIndicacao },
          });

          // Não pode se auto-indicar
          if (indicador && indicador.id !== clienteId) {
            // Verifica se o indicado já tem indicação nesta barbearia
            const indicacaoExistente = await (prisma as any).indicacao.findFirst({
              where: { indicadoId: clienteId, barbeariaId },
            });

            if (!indicacaoExistente) {
              await (prisma as any).indicacao.create({
                data: {
                  barbeariaId,
                  indicadorId: indicador.id,
                  indicadoId: clienteId,
                  pontosAwardados: false,
                },
              });
            }
          }
        }
      }
    } catch (e) {
      console.error('[conectarBarbearia] Erro pós-conexão:', e);
      // Não bloqueia a conexão em caso de erro nos pontos
    }

    return conexao;
  }

  /** Retorna ou gera o código de indicação do cliente */
  static async meuCodigoIndicacao(clienteId: string): Promise<string> {
    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
      select: { codigoIndicacao: true },
    });

    if (cliente?.codigoIndicacao) {
      return cliente.codigoIndicacao;
    }

    // Gera código único de 8 caracteres alfanuméricos
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let codigo = '';
    let tentativas = 0;
    while (tentativas < 20) {
      codigo = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const existente = await prisma.cliente.findUnique({ where: { codigoIndicacao: codigo } });
      if (!existente) break;
      tentativas++;
    }

    await prisma.cliente.update({
      where: { id: clienteId },
      data: { codigoIndicacao: codigo },
    });

    return codigo;
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
            createdAt: true,
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

  /** Dados do perfil do cliente com estatísticas reais */
  static async perfil(clienteId: string) {
    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
      include: {
        usuario: {
          select: { id: true, nome: true, email: true, createdAt: true },
        },
      },
    });
    if (!cliente) throw new Error('Cliente não encontrado');

    // Calcula estatísticas reais a partir dos agendamentos
    const agendamentos = await prisma.agendamento.findMany({
      where: { clienteId },
      select: { status: true, valorCobrado: true },
    });

    const atendimentos = agendamentos.filter(a => a.status === 'CONCLUIDO').length;
    const faltas = agendamentos.filter(a => a.status === 'CANCELADO').length;
    const gastoTotal = agendamentos
      .filter(a => a.status === 'CONCLUIDO')
      .reduce((sum, a) => sum + Number(a.valorCobrado || 0), 0);

    return {
      ...cliente,
      stats: {
        atendimentos,
        faltas,
        gastoTotal,
        dataRegistro: cliente.usuario.createdAt.toISOString(),
      },
    };
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

    return agendamento;
  }

  /** Fidelidade do cliente em uma barbearia */
  static async fidelidade(clienteId: string, barbeariaId: string) {
    const pontosAgregados = await prisma.pontoFidelidade.aggregate({
      _sum: { pontos: true },
      where: { clienteId, barbeariaId },
    });

    const resgatesAgregados = await prisma.resgateRecompensa.aggregate({
      _sum: { pontosUsados: true },
      where: { clienteId, barbeariaId },
    });

    const totalGanhos = pontosAgregados._sum.pontos || 0;
    const totalUsados = resgatesAgregados._sum.pontosUsados || 0;
    const saldo = totalGanhos - totalUsados;

    const config = await prisma.configuracaoFidelidade.findUnique({
      where: { barbeariaId }
    });

    const recompensas = await prisma.recompensa.findMany({
      where: { barbeariaId, ativo: true },
      include: { servico: { select: { nome: true } } },
      orderBy: { pontosNecessarios: 'asc' }
    });

    const pontos = await prisma.pontoFidelidade.findMany({
      where: { clienteId, barbeariaId },
      orderBy: { data: 'desc' },
      take: 20
    });

    const resgates = await prisma.resgateRecompensa.findMany({
      where: { clienteId, barbeariaId },
      include: { recompensa: true },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // Merge history
    const historico = [
      ...pontos.map(p => ({
        id: p.id,
        tipo: 'GANHO',
        pontos: p.pontos,
        descricao: p.descricao,
        data: p.data,
      })),
      ...resgates.map(r => ({
        id: r.id,
        tipo: 'RESGATE',
        pontos: -r.pontosUsados,
        descricao: `Resgate: ${r.recompensa.nome}`,
        data: r.createdAt,
      }))
    ].sort((a, b) => b.data.getTime() - a.data.getTime()).slice(0, 30);

    return {
      saldo,
      totalGanhos,
      totalUsados,
      config: config || { ativo: false },
      recompensas,
      historico,
    };
  }

  static async resgatarRecompensa(clienteId: string, barbeariaId: string, recompensaId: string) {
    const config = await prisma.configuracaoFidelidade.findUnique({ where: { barbeariaId } });
    if (!config?.ativo) {
      throw new Error('Programa de fidelidade inativo nesta barbearia.');
    }

    const recompensa = await prisma.recompensa.findUnique({ where: { id: recompensaId } });
    if (!recompensa || recompensa.barbeariaId !== barbeariaId || !recompensa.ativo) {
      throw new Error('Recompensa não encontrada ou inativa.');
    }

    const pontosAgregados = await prisma.pontoFidelidade.aggregate({
      _sum: { pontos: true },
      where: { clienteId, barbeariaId },
    });

    const resgatesAgregados = await prisma.resgateRecompensa.aggregate({
      _sum: { pontosUsados: true },
      where: { clienteId, barbeariaId },
    });

    const saldo = (pontosAgregados._sum.pontos || 0) - (resgatesAgregados._sum.pontosUsados || 0);

    if (saldo < recompensa.pontosNecessarios) {
      throw new Error('Saldo de pontos insuficiente para esta recompensa.');
    }

    // Cria o resgate
    const resgate = await prisma.resgateRecompensa.create({
      data: {
        clienteId,
        recompensaId,
        barbeariaId,
        pontosUsados: recompensa.pontosNecessarios,
      },
    });

    return resgate;
  }
}
