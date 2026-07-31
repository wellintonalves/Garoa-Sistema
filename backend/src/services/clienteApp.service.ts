// Serviço do app do cliente — autenticação, barbearias, agendamentos, fidelidade
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { authConfig } from '../config/auth';
import { ClienteJWT } from '../types';
import {
  toBrasiliaDate,
  inicioDiaBrasilia,
  fimDiaBrasilia,
  getHoraMinutoBrasilia,
  criarDataHoraBrasilia,
  formatarHorario,
  diaBrasiliaStr,
} from '../lib/timezone';
import { HorariosUtil } from './horarios.util';

const dispCache = new Map<string, { expires: number, data: any }>();

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
  // Cache for most popular service
  private static popularServiceCache = new Map<string, { servicoId: string | null; expiresAt: number }>();

  /** Retorna o serviço mais agendado nos últimos 90 dias (concluídos) */
  static async servicoMaisPopular(barbeariaId: string): Promise<{ servicoId: string | null }> {
    const now = Date.now();
    const cached = this.popularServiceCache.get(barbeariaId);
    if (cached && cached.expiresAt > now) {
      return { servicoId: cached.servicoId };
    }

    const dataLimite = new Date(now - 90 * 24 * 60 * 60 * 1000); // 90 days ago

    // Buscar agendamentos concluídos nos últimos 90 dias
    const agendamentos = await prisma.agendamento.findMany({
      where: {
        barbeariaId,
        status: 'CONCLUIDO',
        dataHora: { gte: dataLimite }
      },
      select: { servicoId: true, valorCobrado: true, itens: { select: { servicoId: true, precoCobrado: true } } }
    });

    if (agendamentos.length < 5) {
      const result = { servicoId: null };
      this.popularServiceCache.set(barbeariaId, { ...result, expiresAt: now + 3600000 }); // 1 hour cache
      return result;
    }

    const stats = new Map<string, { count: number; faturamento: number }>();
    for (const ag of agendamentos) {
      if (ag.itens && ag.itens.length > 0) {
        for (const item of ag.itens) {
          const current = stats.get(item.servicoId) || { count: 0, faturamento: 0 };
          stats.set(item.servicoId, { count: current.count + 1, faturamento: current.faturamento + Number(item.precoCobrado || 0) });
        }
      } else if (ag.servicoId) {
        const current = stats.get(ag.servicoId) || { count: 0, faturamento: 0 };
        stats.set(ag.servicoId, {
          count: current.count + 1,
          faturamento: current.faturamento + Number(ag.valorCobrado || 0)
        });
      }
    }

    let popularId: string | null = null;
    let maxCount = -1;
    let maxFaturamento = -1;

    for (const [sId, s] of Array.from(stats.entries())) {
      if (s.count > maxCount || (s.count === maxCount && s.faturamento > maxFaturamento)) {
        popularId = sId;
        maxCount = s.count;
        maxFaturamento = s.faturamento;
      }
    }

    const result = { servicoId: popularId };
    this.popularServiceCache.set(barbeariaId, { ...result, expiresAt: now + 3600000 }); // 1 hour cache
    return result;
  }


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
    return prisma.servico.findMany({
      where: { barbeariaId, ativo: true },
      orderBy: { nome: 'asc' },
    });
  }

  /** Barbeiros de uma barbearia */
  static async barbeiros(barbeariaId: string) {
    return prisma.barbeiro.findMany({
      where: { barbeariaId, ativo: true },
      include: { usuario: { select: { nome: true } } },
    });
  }

  /** Horários disponíveis */
  static async horariosDisponiveis(barbeariaId: string, barbeiroId: string, data: string, servicosIds: string[]) {
    const servicos = await prisma.servico.findMany({ where: { id: { in: servicosIds } } });
    if (servicos.length === 0) throw new Error('Serviço não encontrado');

    const duracaoTotal = servicos.reduce((acc, s) => acc + s.duracaoMinutos, 0);

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
      include: { 
        itens: { select: { duracaoMinutos: true } }, 
        servico: { select: { duracaoMinutos: true } } 
      },
      orderBy: { dataHora: 'asc' },
    });

    const bloqueios = await prisma.bloqueioAgenda.findMany({
      where: {
        barbeiroId,
        dataInicio: { lte: fim },
        dataFim: { gte: inicio },
      }
    });

    const configDia = await HorariosUtil.getConfigDia(barbeariaId, data, barbeiroId);
    
    const slotsInfo = HorariosUtil.gerarSlotsDisponiveis({
      dataStr: data,
      configDia,
      duracaoMinutos: duracaoTotal,
      agendamentos,
      bloqueios
    });

    return slotsInfo.filter(s => s.disponivel).map(s => ({
      horario: s.horario,
      disponivel: true
    }));
  }

  /** Visão de 7 dias de disponibilidade (fluxo rápido do cliente) */
  static async disponibilidadeSemana(barbeariaId: string, params: {
    barbeiroId?: string;
    duracaoMinutos?: number;
    inicioStr?: string;
    fimStr?: string;
  }) {
    // 1. Resolver Datas (se não vier, default = hoje até +6 dias)
    const hojeSP = diaBrasiliaStr();
    let { inicioStr, fimStr } = params;
    
    if (!inicioStr || !fimStr) {
      inicioStr = hojeSP;
      const dataFimDate = new Date(`${hojeSP}T12:00:00Z`);
      dataFimDate.setDate(dataFimDate.getDate() + 6);
      fimStr = dataFimDate.toISOString().split('T')[0];
    }
    
    // 2. Chave de Cache (30 seg)
    const cacheKey = `${barbeariaId}_${params.barbeiroId || 'all'}_${params.duracaoMinutos || 'min'}_${inicioStr}_${fimStr}`;
    const cached = dispCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    // 3. Descobrir a duração mínima se não informada
    let duracaoReal = params.duracaoMinutos;
    if (!duracaoReal) {
      const servicoMin = await prisma.servico.findFirst({
        where: { barbeariaId, ativo: true },
        orderBy: { duracaoMinutos: 'asc' },
        select: { duracaoMinutos: true }
      });
      duracaoReal = servicoMin?.duracaoMinutos || 30;
    }

    // 4. Barbeiros
    let barbeirosWhere: Prisma.BarbeiroWhereInput = { barbeariaId, ativo: true };
    if (params.barbeiroId) {
      barbeirosWhere.id = params.barbeiroId;
    }
    
    const barbeiros = await prisma.barbeiro.findMany({
      where: barbeirosWhere,
      select: { id: true, usuario: { select: { nome: true } } }
    });

    if (barbeiros.length === 0) return [];

    const dataInicioRange = inicioDiaBrasilia(inicioStr);
    const dataFimRange = fimDiaBrasilia(fimStr);

    // 5. Agendamentos e Bloqueios em lote
    const agendamentosAll = await prisma.agendamento.findMany({
      where: {
        barbeariaId,
        barbeiroId: params.barbeiroId ? params.barbeiroId : undefined,
        dataHora: { gte: dataInicioRange, lte: dataFimRange },
        status: { not: 'CANCELADO' }
      },
      include: {
        itens: { select: { duracaoMinutos: true } },
        servico: { select: { duracaoMinutos: true } }
      }
    });

    const bloqueiosAll = await prisma.bloqueioAgenda.findMany({
      where: {
        barbeiroId: params.barbeiroId ? params.barbeiroId : undefined,
        dataInicio: { lte: dataFimRange },
        dataFim: { gte: dataInicioRange }
      }
    });

    // Construir dias da semana: iterar de inicioStr até fimStr
    const diasRange: string[] = [];
    let dIter = new Date(`${inicioStr}T12:00:00Z`);
    const dEnd = new Date(`${fimStr}T12:00:00Z`);
    while (dIter <= dEnd) {
      diasRange.push(dIter.toISOString().split('T')[0]);
      dIter.setDate(dIter.getDate() + 1);
    }

    const agoraSP = new Date(); // Para filtrar slots passados de hoje

    const resultado = await Promise.all(barbeiros.map(async (barb) => {
      const agendsBarb = agendamentosAll.filter(a => a.barbeiroId === barb.id);
      const blocksBarb = bloqueiosAll.filter(b => b.barbeiroId === barb.id);

      const diasDisponiveis = await Promise.all(diasRange.map(async (dataAtual) => {
        const configDia = await HorariosUtil.getConfigDia(barbeariaId, dataAtual, barb.id);
        
        let folga = configDia.fechado;
        let slotsFinais: any[] = [];

        if (!folga) {
          const slotsRaw = HorariosUtil.gerarSlotsDisponiveis({
            dataStr: dataAtual,
            configDia,
            duracaoMinutos: duracaoReal!,
            agendamentos: agendsBarb,
            bloqueios: blocksBarb
          });

          const isHoje = dataAtual === hojeSP;

          slotsFinais = slotsRaw.map(s => {
            // Se for hoje, filtra slots passados
            if (isHoje) {
              const [h, m] = s.horario.split(':').map(Number);
              const slotDateSP = criarDataHoraBrasilia(dataAtual, h, m);
              if (slotDateSP < agoraSP) {
                 return null; // Slot passou
              }
            }
            return {
              horario: s.horario,
              disponivel: s.disponivel
            };
          }).filter(s => s !== null);
          
          // Se gerou 0 slots porque todos passaram (ou porque lotou), ainda é um dia de trabalho (não folga)
        }

        return {
          data: dataAtual,
          folga: folga,
          fechado: folga, // mantendo similar ao folga para semantica da UI
          slots: slotsFinais
        };
      }));

      return {
        barbeiroId: barb.id,
        barbeiroNome: barb.usuario?.nome || 'Barbeiro',
        dias: diasDisponiveis
      };
    }));

    dispCache.set(cacheKey, { expires: Date.now() + 30000, data: resultado });
    
    // Limpeza de cache velha para evitar leak
    if (dispCache.size > 1000) {
      const now = Date.now();
      for (const [k, v] of dispCache.entries()) {
        if (v.expires < now) dispCache.delete(k);
      }
    }

    return resultado;
  }

  /** Cria agendamento pelo cliente */
  static async agendar(clienteId: string, barbeariaId: string, dados: {
    barbeiroId: string;
    servicosIds?: string[];
    servicoId?: string;
    data: string;
    hora: string;
    observacoes?: string;
  }) {
    const ids = dados.servicosIds && dados.servicosIds.length > 0 ? dados.servicosIds : (dados.servicoId ? [dados.servicoId] : []);
    if (ids.length === 0) throw new Error('Pelo menos um serviço deve ser selecionado');

    const servicos = await prisma.servico.findMany({ where: { id: { in: ids } } });
    if (servicos.length !== ids.length) throw new Error('Um ou mais serviços não foram encontrados');

    const duracaoTotal = servicos.reduce((acc, s) => acc + s.duracaoMinutos, 0);
    const valorTotal = servicos.reduce((acc, s) => acc + Number(s.preco), 0);

    const dataHora = toBrasiliaDate(`${dados.data}T${dados.hora}:00`);

    await HorariosUtil.validarDentroDoFuncionamento({
      barbeariaId,
      barbeiroId: dados.barbeiroId,
      dataHora,
      duracaoMinutos: duracaoTotal
    });

    const dataInicioDia = inicioDiaBrasilia(dados.data);
    const dataFimDia = fimDiaBrasilia(dados.data);

    const agendamentosDia = await prisma.agendamento.findMany({
      where: {
        barbeiroId: dados.barbeiroId,
        status: { notIn: ['CANCELADO'] },
        dataHora: { gte: dataInicioDia, lte: dataFimDia },
      },
      include: { itens: true, servico: true }
    });

    const reqInicioM = dataHora.getUTCHours() * 60 + dataHora.getUTCMinutes();
    const reqFimM = reqInicioM + duracaoTotal;

    const conflito = agendamentosDia.some(ag => {
      const agDate = new Date(ag.dataHora);
      const agInicioM = agDate.getUTCHours() * 60 + agDate.getUTCMinutes();
      const agDuracao = (ag as any).itens && (ag as any).itens.length > 0
        ? (ag as any).itens.reduce((acc: number, i: any) => acc + i.duracaoMinutos, 0)
        : ((ag as any).servico?.duracaoMinutos || 30);
      const agFimM = agInicioM + agDuracao;
      return reqInicioM < agFimM && reqFimM > agInicioM;
    });

    if (conflito) throw new Error('Horário já ocupado para este barbeiro');

    const conflitoBloqueio = await prisma.bloqueioAgenda.findFirst({
      where: {
        barbeiroId: dados.barbeiroId,
        dataInicio: { lt: new Date(dataHora.getTime() + duracaoTotal * 60000) },
        dataFim: { gt: dataHora }
      }
    });

    if (conflitoBloqueio) throw new Error('Horário indisponível (bloqueado pelo barbeiro)');

    const agendamento = await prisma.agendamento.create({
      data: {
        barbeariaId,
        clienteId,
        barbeiroId: dados.barbeiroId,
        servicosIds: ids, // opcional manter aqui para index
        dataHora,
        valorCobrado: valorTotal,
        origem: 'APP_CLIENTE',
        observacoes: dados.observacoes,
        itens: {
          create: servicos.map(s => ({
            servicoId: s.id,
            precoCobrado: s.preco,
            duracaoMinutos: s.duracaoMinutos,
            comissaoPercent: s.comissaoPercent,
          }))
        }
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
      where: { clienteId, barbeariaId, status: { in: ['PENDENTE', 'CONFIRMADO'] } },
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
        status: (r as any).status,
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

    let tentativas = 0;
    while (tentativas <= 2) {
      try {
        const resgate = await prisma.$transaction(async (tx) => {
          const pontosAgregados = await tx.pontoFidelidade.aggregate({
            _sum: { pontos: true },
            where: { clienteId, barbeariaId },
          });

          const resgatesAgregados = await tx.resgateRecompensa.aggregate({
            _sum: { pontosUsados: true },
            where: { clienteId, barbeariaId, status: { in: ['PENDENTE', 'CONFIRMADO'] } },
          });

          const saldo = (pontosAgregados._sum.pontos || 0) - (resgatesAgregados._sum.pontosUsados || 0);

          if (saldo < recompensa.pontosNecessarios) {
            throw new Error('Saldo de pontos insuficiente para esta recompensa.');
          }

          // Cria o resgate
          return await tx.resgateRecompensa.create({
            data: {
              clienteId,
              recompensaId,
              barbeariaId,
              pontosUsados: recompensa.pontosNecessarios,
              status: 'PENDENTE',
            },
          });
        }, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });

        return resgate;
      } catch (e: any) {
        if (e.code === 'P2034' && tentativas < 2) {
          tentativas++;
          continue;
        }
        throw e;
      }
    }
  }
}
