// Serviço de clientes — CRUD + dados agregados por barbearia
import { prisma } from '../lib/prisma';

interface DadosCliente {
  nome: string;
  email: string;
  senha: string;
  telefone?: string;
  dataNascimento?: string;
  observacoes?: string;
}

interface DadosAtualizacao {
  telefone?: string;
  dataNascimento?: string;
  observacoes?: string;
}

/** Determina o nível de fidelidade com base nos pontos */
function calcularNivel(pontos: number): { nivel: string; cor: string; proximoNivel: number; pontosParaProximo: number } {
  if (pontos >= 1500) return { nivel: 'Diamante', cor: '#00BFFF', proximoNivel: 999999, pontosParaProximo: 0 };
  if (pontos >= 700) return { nivel: 'Ouro', cor: '#FFD700', proximoNivel: 1500, pontosParaProximo: 1500 - pontos };
  if (pontos >= 300) return { nivel: 'Prata', cor: '#C0C0C0', proximoNivel: 700, pontosParaProximo: 700 - pontos };
  return { nivel: 'Bronze', cor: '#CD7F32', proximoNivel: 300, pontosParaProximo: 300 - pontos };
}

export class ClienteService {
  /**
   * Lista todos os clientes vinculados a uma barbearia via ClienteBarbearia.
   * Retorna dados agregados: visitas, gasto total, pontos, nível.
   */
  static async listarTodos(barbeariaId: string, filtros?: {
    busca?: string;
    nivel?: string;
    ordenar?: string;
  }) {
    // Busca clientes vinculados via tabela de junção ClienteBarbearia
    const vinculos = await prisma.clienteBarbearia.findMany({
      where: { barbeariaId },
      select: { clienteId: true },
    });
    const idsPorVinculo = vinculos.map((v: any) => v.clienteId);

    // Busca clientes vinculados diretamente via Cliente.barbeariaId
    const clientesDiretos = await prisma.cliente.findMany({
      where: { barbeariaId },
      select: { id: true },
    });
    const idsDiretos = clientesDiretos.map((c: any) => c.id);

    // Combina sem duplicatas
    const clienteIds = [...new Set([...idsPorVinculo, ...idsDiretos])];
    if (clienteIds.length === 0) return [];

    // Monta o filtro de busca
    const buscaFilter = filtros?.busca
      ? {
          OR: [
            { usuario: { nome: { contains: filtros.busca, mode: 'insensitive' as const } } },
            { telefone: { contains: filtros.busca } },
          ],
        }
      : {};

    const clientes: any[] = await (prisma.cliente as any).findMany({
      where: {
        id: { in: clienteIds },
        ...buscaFilter,
      },
      include: {
        usuario: {
          select: { id: true, nome: true, email: true },
        },
        agendamentos: {
          where: { barbeariaId },
          select: {
            id: true,
            dataHora: true,
            status: true,
            valorCobrado: true,
          },
        },
        pontosFidelidade: {
          where: { barbeariaId },
          select: { pontos: true },
        },
        resgatesRecompensa: {
          where: { barbeariaId },
          select: { pontosUsados: true },
        },
      },
    });

    // Processar e agregar dados
    const resultado = clientes.map((c: any) => {
      const agConcluidos = (c.agendamentos || []).filter((a: any) => a.status === 'CONCLUIDO');
      const totalVisitas = agConcluidos.length;
      const totalGasto = agConcluidos.reduce((s: number, a: any) => s + Number(a.valorCobrado), 0);

      const ultimoAtendimento = agConcluidos.length > 0
        ? agConcluidos.sort((a: any, b: any) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())[0].dataHora
        : null;

      const pontosGanhos = (c.pontosFidelidade || []).reduce((s: number, p: any) => s + p.pontos, 0);
      const pontosUsados = (c.resgatesRecompensa || []).reduce((s: number, r: any) => s + r.pontosUsados, 0);
      const pontosAtuais = pontosGanhos - pontosUsados;
      const nivelInfo = calcularNivel(pontosAtuais);

      return {
        id: c.id,
        usuario: c.usuario,
        telefone: c.telefone,
        dataNascimento: c.dataNascimento,
        observacoes: c.observacoes,
        totalVisitas,
        totalGasto: Number(totalGasto.toFixed(2)),
        ultimoAtendimento,
        pontosAtuais,
        ...nivelInfo,
      };
    });

    // Filtrar por nível
    let filtrado = resultado;
    if (filtros?.nivel && filtros.nivel !== 'Todos') {
      filtrado = filtrado.filter((c: any) => c.nivel === filtros.nivel);
    }

    // Ordenação
    switch (filtros?.ordenar) {
      case 'visitas':
        filtrado.sort((a: any, b: any) => b.totalVisitas - a.totalVisitas);
        break;
      case 'gasto':
        filtrado.sort((a: any, b: any) => b.totalGasto - a.totalGasto);
        break;
      case 'pontos':
        filtrado.sort((a: any, b: any) => b.pontosAtuais - a.pontosAtuais);
        break;
      case 'recente':
      default:
        filtrado.sort((a: any, b: any) => {
          if (!a.ultimoAtendimento && !b.ultimoAtendimento) return 0;
          if (!a.ultimoAtendimento) return 1;
          if (!b.ultimoAtendimento) return -1;
          return new Date(b.ultimoAtendimento).getTime() - new Date(a.ultimoAtendimento).getTime();
        });
        break;
    }

    return filtrado;
  }

  /** Busca cliente por ID com perfil completo (para o modal) */
  static async buscarPorIdCompleto(id: string, barbeariaId: string) {
    const cliente: any = await (prisma.cliente as any).findUnique({
      where: { id },
      include: {
        usuario: {
          select: { id: true, nome: true, email: true },
        },
        agendamentos: {
          where: { barbeariaId },
          include: {
            servico: { select: { nome: true } },
            barbeiro: { include: { usuario: { select: { nome: true } } } },
          },
          orderBy: { dataHora: 'desc' },
        },
        pontosFidelidade: {
          where: { barbeariaId },
          orderBy: { data: 'desc' },
        },
        resgatesRecompensa: {
          where: { barbeariaId },
          include: { recompensa: { select: { nome: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!cliente) throw new Error('Cliente não encontrado');

    const agConcluidos = (cliente.agendamentos || []).filter((a: any) => a.status === 'CONCLUIDO');
    const totalVisitas = agConcluidos.length;
    const totalGasto = agConcluidos.reduce((s: number, a: any) => s + Number(a.valorCobrado), 0);
    const ticketMedio = totalVisitas > 0 ? totalGasto / totalVisitas : 0;

    const primeiraVisita = agConcluidos.length > 0
      ? agConcluidos[agConcluidos.length - 1].dataHora
      : null;
    const ultimaVisita = agConcluidos.length > 0
      ? agConcluidos[0].dataHora
      : null;

    const pontosGanhos = (cliente.pontosFidelidade || []).reduce((s: number, p: any) => s + p.pontos, 0);
    const pontosUsados = (cliente.resgatesRecompensa || []).reduce((s: number, r: any) => s + r.pontosUsados, 0);
    const pontosAtuais = pontosGanhos - pontosUsados;
    const nivelInfo = calcularNivel(pontosAtuais);

    return {
      id: cliente.id,
      usuario: cliente.usuario,
      telefone: cliente.telefone,
      dataNascimento: cliente.dataNascimento,
      observacoes: cliente.observacoes,
      // Estatísticas
      totalVisitas,
      totalGasto: Number(totalGasto.toFixed(2)),
      ticketMedio: Number(ticketMedio.toFixed(2)),
      primeiraVisita,
      ultimaVisita,
      // Fidelidade
      pontosAtuais,
      pontosGanhos,
      pontosUsados,
      ...nivelInfo,
      // Históricos
      agendamentos: (cliente.agendamentos || []).map((a: any) => ({
        id: a.id,
        dataHora: a.dataHora,
        status: a.status,
        valorCobrado: a.valorCobrado,
        servico: a.servico?.nome || '—',
        barbeiro: a.barbeiro?.usuario?.nome || '—',
      })),
      historicoPontos: (cliente.pontosFidelidade || []).map((p: any) => ({
        id: p.id,
        pontos: p.pontos,
        descricao: p.descricao,
        data: p.data,
      })),
      historicoResgates: (cliente.resgatesRecompensa || []).map((r: any) => ({
        id: r.id,
        pontosUsados: r.pontosUsados,
        recompensa: r.recompensa?.nome || '—',
        data: r.createdAt,
      })),
    };
  }

  /** Adicionar pontos manualmente (cortesia do admin) */
  static async adicionarPontos(clienteId: string, barbeariaId: string, pontos: number, descricao: string) {
    return prisma.pontoFidelidade.create({
      data: {
        clienteId,
        barbeariaId,
        pontos,
        descricao: descricao || 'Pontos adicionados manualmente pelo admin',
      },
    });
  }

  /** Resgatar recompensa (admin registra presencialmente) */
  static async resgatarRecompensa(clienteId: string, recompensaId: string, barbeariaId: string) {
    const recompensa: any = await (prisma as any).recompensa.findUnique({ where: { id: recompensaId } });
    if (!recompensa || recompensa.barbeariaId !== barbeariaId || !recompensa.ativo) {
      throw new Error('Recompensa não encontrada ou inativa');
    }

    // Calcular saldo de pontos
    const pontosAgregados = await prisma.pontoFidelidade.aggregate({
      _sum: { pontos: true },
      where: { clienteId, barbeariaId },
    });
    const resgatesAgregados = await (prisma as any).resgateRecompensa.aggregate({
      _sum: { pontosUsados: true },
      where: { clienteId, barbeariaId },
    });
    const saldo = (pontosAgregados._sum.pontos || 0) - (resgatesAgregados._sum.pontosUsados || 0);

    if (saldo < recompensa.pontosNecessarios) {
      throw new Error('Saldo de pontos insuficiente');
    }

    return (prisma as any).resgateRecompensa.create({
      data: {
        clienteId,
        recompensaId,
        barbeariaId,
        pontosUsados: recompensa.pontosNecessarios,
      },
    });
  }

  /** Aniversariantes do mês atual */
  static async aniversariantesDoMes(barbeariaId: string) {
    const mesAtual = new Date().getMonth() + 1; // 1-12

    // Combina clientes de ClienteBarbearia + Cliente.barbeariaId
    const vinculos = await prisma.clienteBarbearia.findMany({
      where: { barbeariaId },
      select: { clienteId: true },
    });
    const idsPorVinculo = vinculos.map((v: any) => v.clienteId);

    const clientesDiretos = await prisma.cliente.findMany({
      where: { barbeariaId },
      select: { id: true },
    });
    const idsDiretos = clientesDiretos.map((c: any) => c.id);

    const clienteIds = [...new Set([...idsPorVinculo, ...idsDiretos])];
    if (clienteIds.length === 0) return [];

    const clientes: any[] = await (prisma.cliente as any).findMany({
      where: {
        id: { in: clienteIds },
        dataNascimento: { not: null },
      },
      include: {
        usuario: { select: { id: true, nome: true, email: true } },
      },
    });

    // Filtrar pelo mês de nascimento
    return clientes
      .filter((c: any) => c.dataNascimento && (new Date(c.dataNascimento).getMonth() + 1) === mesAtual)
      .map((c: any) => ({
        id: c.id,
        usuario: c.usuario,
        telefone: c.telefone,
        dataNascimento: c.dataNascimento,
        diaAniversario: new Date(c.dataNascimento).getDate(),
      }))
      .sort((a: any, b: any) => a.diaAniversario - b.diaAniversario);
  }

  /** Resumo / stats para cards do topo */
  static async resumo(barbeariaId: string) {
    // Combina clientes de ClienteBarbearia + Cliente.barbeariaId
    const vinculos = await prisma.clienteBarbearia.findMany({
      where: { barbeariaId },
      select: { clienteId: true },
    });
    const idsPorVinculo = vinculos.map((v: any) => v.clienteId);

    const clientesDiretos = await prisma.cliente.findMany({
      where: { barbeariaId },
      select: { id: true },
    });
    const idsDiretos = clientesDiretos.map((c: any) => c.id);

    const clienteIds = [...new Set([...idsPorVinculo, ...idsDiretos])];
    const totalClientes = clienteIds.length;

    // Clientes ativos no mês (com agendamento concluído no mês atual)
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const agendamentosMes: any[] = clienteIds.length > 0
      ? await prisma.agendamento.findMany({
          where: {
            barbeariaId,
            clienteId: { in: clienteIds },
            status: 'CONCLUIDO',
            dataHora: { gte: inicioMes },
          },
          select: { clienteId: true, valorCobrado: true },
        })
      : [];

    const clientesAtivos = new Set(agendamentosMes.map((a: any) => a.clienteId)).size;

    // Ticket médio geral (todos os concluídos)
    const todosAgendamentos: any = clienteIds.length > 0
      ? await prisma.agendamento.aggregate({
          _avg: { valorCobrado: true },
          _count: true,
          where: {
            barbeariaId,
            clienteId: { in: clienteIds },
            status: 'CONCLUIDO',
          },
        })
      : { _avg: { valorCobrado: null }, _count: 0 };

    return {
      totalClientes,
      clientesAtivos,
      ticketMedio: Number(Number(todosAgendamentos._avg.valorCobrado || 0).toFixed(2)),
    };
  }

  /** Busca cliente por ID (legado - mantido para compatibilidade) */
  static async buscarPorId(id: string) {
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: {
        usuario: {
          select: { id: true, nome: true, email: true },
        },
        agendamentos: {
          include: {
            servico: true,
            barbeiro: { include: { usuario: { select: { nome: true } } } },
          },
          orderBy: { dataHora: 'desc' },
          take: 20,
        },
      },
    });

    if (!cliente) throw new Error('Cliente não encontrado');
    return cliente;
  }

  /** Busca clientes por nome ou telefone (legado) */
  static async buscar(termo: string) {
    return prisma.cliente.findMany({
      where: {
        OR: [
          { usuario: { nome: { contains: termo, mode: 'insensitive' } } },
          { telefone: { contains: termo } },
        ],
      },
      include: {
        usuario: {
          select: { id: true, nome: true, email: true },
        },
      },
    });
  }

  /** Cria um novo cliente (com usuário) */
  static async criar(dados: DadosCliente) {
    const bcrypt = await import('bcryptjs');
    const senhaHash = await bcrypt.hash(dados.senha, 10);

    return prisma.cliente.create({
      data: {
        telefone: dados.telefone,
        dataNascimento: dados.dataNascimento ? new Date(dados.dataNascimento) : null,
        observacoes: dados.observacoes,
        usuario: {
          create: {
            nome: dados.nome,
            email: dados.email,
            senha: senhaHash,
            papel: 'CLIENTE' as any,
          } as any,
        },
      },
      include: {
        usuario: {
          select: { id: true, nome: true, email: true },
        },
      },
    });
  }

  /** Atualiza dados do cliente */
  static async atualizar(id: string, dados: DadosAtualizacao) {
    return prisma.cliente.update({
      where: { id },
      data: {
        ...dados,
        dataNascimento: dados.dataNascimento ? new Date(dados.dataNascimento) : undefined,
      } as any,
      include: {
        usuario: {
          select: { id: true, nome: true, email: true },
        },
      },
    });
  }

  /** Remove um cliente */
  static async remover(id: string) {
    const cliente = await prisma.cliente.findUnique({ where: { id } });
    if (!cliente) throw new Error('Cliente não encontrado');

    await prisma.cliente.delete({ where: { id } });
    await prisma.usuario.delete({ where: { id: cliente.usuarioId } });
  }
}
