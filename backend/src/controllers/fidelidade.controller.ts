import { Response } from 'express';
import { AuthRequest } from '../types';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

export class FidelidadeController {
  // Configuração
  static async obterConfiguracao(req: AuthRequest, res: Response): Promise<void> {
    try {
      const barbeariaId = req.usuario?.barbeariaId;
      if (!barbeariaId) {
        res.status(400).json({ erro: 'Barbearia ID não encontrado no usuário.' });
        return;
      }

      let config = await prisma.configuracaoFidelidade.findUnique({
        where: { barbeariaId },
      });

      if (!config) {
        config = await prisma.configuracaoFidelidade.create({
          data: { barbeariaId },
        });
      }

      res.json(config);
    } catch (error) {
      console.error('Erro ao obter configuração de fidelidade:', error);
      res.status(500).json({ erro: 'Erro ao obter configuração de fidelidade.' });
    }
  }

  static async atualizarConfiguracao(req: AuthRequest, res: Response): Promise<void> {
    try {
      const barbeariaId = req.usuario?.barbeariaId;
      if (!barbeariaId) {
        res.status(400).json({ erro: 'Barbearia ID não encontrado no usuário.' });
        return;
      }

      const {
        ativo,
        pontosPorReal,
        pontosPorVisita,
        pontosDobroAniversario,
        pontosPorIndicacao,
        pontosBoasVindas,
        regrasPorServico,
      } = req.body;

      const config = await prisma.configuracaoFidelidade.upsert({
        where: { barbeariaId },
        update: {
          ativo,
          pontosPorReal,
          pontosPorVisita,
          pontosDobroAniversario,
          pontosPorIndicacao: pontosPorIndicacao ?? 0,
          pontosBoasVindas: pontosBoasVindas ?? 0,
          regrasPorServico: regrasPorServico ?? null,
        },
        create: {
          barbeariaId,
          ativo,
          pontosPorReal,
          pontosPorVisita,
          pontosDobroAniversario,
          pontosPorIndicacao: pontosPorIndicacao ?? 0,
          pontosBoasVindas: pontosBoasVindas ?? 0,
          regrasPorServico: regrasPorServico ?? null,
        },
      });

      res.json(config);
    } catch (error) {
      console.error('Erro ao atualizar configuração de fidelidade:', error);
      res.status(500).json({ erro: 'Erro ao atualizar configuração de fidelidade.' });
    }
  }

  // Recompensas
  static async listarRecompensas(req: AuthRequest, res: Response): Promise<void> {
    try {
      const barbeariaId = req.usuario?.barbeariaId;
      if (!barbeariaId) {
        res.status(400).json({ erro: 'Barbearia ID não encontrado.' });
        return;
      }

      const recompensas = await prisma.recompensa.findMany({
        where: { barbeariaId },
        include: { servico: true },
        orderBy: { pontosNecessarios: 'asc' },
      });

      res.json(recompensas);
    } catch (error) {
      console.error('Erro ao listar recompensas:', error);
      res.status(500).json({ erro: 'Erro ao listar recompensas.' });
    }
  }

  static async criarRecompensa(req: AuthRequest, res: Response): Promise<void> {
    try {
      const barbeariaId = req.usuario?.barbeariaId;
      if (!barbeariaId) {
        res.status(400).json({ erro: 'Barbearia ID não encontrado.' });
        return;
      }

      const { nome, tipo, valorDesconto, servicoId, pontosNecessarios, ativo } = req.body;

      const recompensa = await prisma.recompensa.create({
        data: {
          barbeariaId,
          nome,
          tipo,
          valorDesconto,
          servicoId,
          pontosNecessarios,
          ativo,
        },
      });

      res.status(201).json(recompensa);
    } catch (error) {
      console.error('Erro ao criar recompensa:', error);
      res.status(500).json({ erro: 'Erro ao criar recompensa.' });
    }
  }

  static async atualizarRecompensa(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const barbeariaId = req.usuario?.barbeariaId;

      if (!barbeariaId) {
        res.status(400).json({ erro: 'Barbearia ID não encontrado.' });
        return;
      }

      const recompensaExistente = await prisma.recompensa.findUnique({ where: { id } });
      if (!recompensaExistente || recompensaExistente.barbeariaId !== barbeariaId) {
        res.status(404).json({ erro: 'Recompensa não encontrada.' });
        return;
      }

      const { nome, tipo, valorDesconto, servicoId, pontosNecessarios, ativo } = req.body;

      const recompensa = await prisma.recompensa.update({
        where: { id },
        data: { nome, tipo, valorDesconto, servicoId, pontosNecessarios, ativo },
      });

      res.json(recompensa);
    } catch (error) {
      console.error('Erro ao atualizar recompensa:', error);
      res.status(500).json({ erro: 'Erro ao atualizar recompensa.' });
    }
  }

  static async removerRecompensa(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const barbeariaId = req.usuario?.barbeariaId;

      if (!barbeariaId) {
        res.status(400).json({ erro: 'Barbearia ID não encontrado.' });
        return;
      }

      const recompensaExistente = await prisma.recompensa.findUnique({ where: { id } });
      if (!recompensaExistente || recompensaExistente.barbeariaId !== barbeariaId) {
        res.status(404).json({ erro: 'Recompensa não encontrada.' });
        return;
      }

      await prisma.recompensa.delete({ where: { id } });

      res.status(204).send();
    } catch (error) {
      console.error('Erro ao remover recompensa:', error);
      res.status(500).json({ erro: 'Erro ao remover recompensa.' });
    }
  }

  // Resgates
  static async listarResgates(req: AuthRequest, res: Response): Promise<void> {
    try {
      const barbeariaId = req.usuario?.barbeariaId;
      if (!barbeariaId) {
        res.status(400).json({ erro: 'Barbearia ID não encontrado.' });
        return;
      }

      const { clienteId, dataInicio, dataFim } = req.query;

      const resgates = await prisma.resgateRecompensa.findMany({
        where: {
          barbeariaId,
          ...(clienteId ? { clienteId: String(clienteId) } : {}),
          ...(dataInicio && dataFim
            ? {
                createdAt: {
                  gte: new Date(String(dataInicio)),
                  lte: new Date(String(dataFim)),
                },
              }
            : {}),
        },
        include: {
          cliente: { select: { id: true, usuario: { select: { nome: true, email: true } } } },
          recompensa: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json(resgates);
    } catch (error) {
      console.error('Erro ao listar resgates:', error);
      res.status(500).json({ erro: 'Erro ao listar resgates.' });
    }
  }

  static async resgatarRecompensa(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { clienteId, recompensaId } = req.params;
      const barbeariaId = req.usuario?.barbeariaId;

      if (!barbeariaId) {
        res.status(400).json({ erro: 'Barbearia ID não encontrado.' });
        return;
      }

      const recompensa = await prisma.recompensa.findUnique({ where: { id: recompensaId } });
      if (!recompensa || recompensa.barbeariaId !== barbeariaId || !recompensa.ativo) {
        res.status(404).json({ erro: 'Recompensa não encontrada ou inativa.' });
        return;
      }

      let tentativas = 0;
      let resgate;

      while (tentativas <= 2) {
        try {
          resgate = await prisma.$transaction(async (tx) => {
            const pontosAgregados = await tx.pontoFidelidade.aggregate({
              _sum: { pontos: true },
              where: { clienteId, barbeariaId },
            });

            const resgatesAgregados = await tx.resgateRecompensa.aggregate({
              _sum: { pontosUsados: true },
              where: { clienteId, barbeariaId },
            });

            const totalGanho = pontosAgregados._sum.pontos || 0;
            const totalGasto = resgatesAgregados._sum.pontosUsados || 0;
            const saldo = totalGanho - totalGasto;

            if (saldo < recompensa.pontosNecessarios) {
              throw new Error('Saldo de pontos insuficiente.');
            }

            return await tx.resgateRecompensa.create({
              data: {
                clienteId,
                recompensaId,
                barbeariaId,
                pontosUsados: recompensa.pontosNecessarios,
              },
            });
          }, {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          });

          break; // Sucesso, sai do loop
        } catch (error: any) {
          if (error.code === 'P2034' && tentativas < 2) {
            tentativas++;
            continue;
          }
          throw error;
        }
      }

      res.status(201).json(resgate);
    } catch (error: any) {
      console.error('Erro ao resgatar recompensa:', error);
      if (error.message === 'Saldo de pontos insuficiente.') {
        res.status(400).json({ erro: error.message });
      } else {
        res.status(500).json({ erro: 'Erro ao resgatar recompensa.' });
      }
    }
  }

  // Ajuste manual de pontos (admin)
  static async ajustarPontos(req: AuthRequest, res: Response): Promise<void> {
    try {
      const barbeariaId = req.usuario?.barbeariaId;
      const { clienteId } = req.params;
      const { pontos, descricao } = req.body;

      if (!barbeariaId) {
        res.status(400).json({ erro: 'Barbearia ID não encontrado.' });
        return;
      }

      if (!pontos || pontos === 0) {
        res.status(400).json({ erro: 'Pontos não podem ser zero.' });
        return;
      }

      if (!descricao) {
        res.status(400).json({ erro: 'Descrição é obrigatória.' });
        return;
      }

      // Verifica se o cliente pertence a esta barbearia
      const clienteBarbearia = await prisma.clienteBarbearia.findUnique({
        where: { clienteId_barbeariaId: { clienteId, barbeariaId } },
      });

      if (!clienteBarbearia) {
        res.status(404).json({ erro: 'Cliente não encontrado nesta barbearia.' });
        return;
      }

      const registro = await prisma.pontoFidelidade.create({
        data: {
          clienteId,
          barbeariaId,
          pontos: Number(pontos),
          descricao: `[Ajuste manual] ${descricao}`,
        },
      });

      res.status(201).json(registro);
    } catch (error) {
      console.error('Erro ao ajustar pontos:', error);
      res.status(500).json({ erro: 'Erro ao ajustar pontos.' });
    }
  }

  // Histórico de pontos de um cliente (admin)
  static async historicoCliente(req: AuthRequest, res: Response): Promise<void> {
    try {
      const barbeariaId = req.usuario?.barbeariaId;
      const { clienteId } = req.params;

      if (!barbeariaId) {
        res.status(400).json({ erro: 'Barbearia ID não encontrado.' });
        return;
      }

      const [pontos, resgates] = await Promise.all([
        prisma.pontoFidelidade.findMany({
          where: { clienteId, barbeariaId },
          orderBy: { data: 'desc' },
        }),
        prisma.resgateRecompensa.findMany({
          where: { clienteId, barbeariaId },
          include: { recompensa: { select: { nome: true } } },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      // Mescla os dois arrays numa linha do tempo
      const historico = [
        ...pontos.map(p => ({
          id: p.id,
          tipo: 'GANHO' as const,
          pontos: p.pontos,
          descricao: p.descricao,
          data: p.data.toISOString(),
        })),
        ...resgates.map(r => ({
          id: r.id,
          tipo: 'RESGATE' as const,
          pontos: -r.pontosUsados,
          descricao: `Resgate: ${r.recompensa.nome}`,
          data: r.createdAt.toISOString(),
        })),
      ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

      const totalGanho = pontos.reduce((s, p) => s + p.pontos, 0);
      const totalGasto = resgates.reduce((s, r) => s + r.pontosUsados, 0);
      const saldo = totalGanho - totalGasto;

      res.json({ saldo, totalGanho, totalGasto, historico });
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      res.status(500).json({ erro: 'Erro ao buscar histórico.' });
    }
  }

  // Lista clientes com saldo de pontos (admin)
  static async listarClientesComPontos(req: AuthRequest, res: Response): Promise<void> {
    try {
      const barbeariaId = req.usuario?.barbeariaId;
      if (!barbeariaId) {
        res.status(400).json({ erro: 'Barbearia ID não encontrado.' });
        return;
      }

      // Busca todos os clientes conectados à barbearia
      const conexoes = await prisma.clienteBarbearia.findMany({
        where: { barbeariaId },
        include: {
          cliente: {
            include: {
              usuario: { select: { nome: true, email: true } },
              pontosFidelidade: {
                where: { barbeariaId },
                select: { pontos: true },
              },
              resgatesRecompensa: {
                where: { barbeariaId },
                select: { pontosUsados: true },
              },
            },
          },
        },
        orderBy: { conectadoEm: 'desc' },
      });

      const clientes = conexoes.map(c => {
        const totalGanho = c.cliente.pontosFidelidade.reduce((s, p) => s + p.pontos, 0);
        const totalGasto = c.cliente.resgatesRecompensa.reduce((s, r) => s + r.pontosUsados, 0);
        const saldo = totalGanho - totalGasto;
        return {
          id: c.cliente.id,
          nome: c.cliente.usuario.nome,
          email: c.cliente.usuario.email,
          saldo,
          totalGanho,
          totalGasto,
          codigoIndicacao: c.cliente.codigoIndicacao,
          conectadoEm: c.conectadoEm,
        };
      });

      // Ordena por saldo (maior primeiro)
      clientes.sort((a, b) => b.saldo - a.saldo);

      res.json(clientes);
    } catch (error) {
      console.error('Erro ao listar clientes com pontos:', error);
      res.status(500).json({ erro: 'Erro ao listar clientes.' });
    }
  }
}
