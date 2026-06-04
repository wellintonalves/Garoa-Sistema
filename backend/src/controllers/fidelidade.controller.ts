import { Response } from 'express';
import { AuthRequest } from '../types';
import { prisma } from '../lib/prisma';

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

      const { ativo, pontosPorReal, pontosPorVisita, pontosDobroAniversario } = req.body;

      const config = await prisma.configuracaoFidelidade.upsert({
        where: { barbeariaId },
        update: { ativo, pontosPorReal, pontosPorVisita, pontosDobroAniversario },
        create: {
          barbeariaId,
          ativo,
          pontosPorReal,
          pontosPorVisita,
          pontosDobroAniversario,
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

      // Validar se a recompensa pertence a barbearia
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

      // Pegar os filtros de período e cliente
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

      // Validar os pontos do cliente (soma de entradas - saídas ou um saldo consolidado).
      // Como não existe uma coluna de "saldo_total" explícita, podemos calcular.
      const pontosAgregados = await prisma.pontoFidelidade.aggregate({
        _sum: { pontos: true },
        where: { clienteId, barbeariaId },
      });

      const resgatesAgregados = await prisma.resgateRecompensa.aggregate({
        _sum: { pontosUsados: true },
        where: { clienteId, barbeariaId },
      });

      const totalGanho = pontosAgregados._sum.pontos || 0;
      const totalGasto = resgatesAgregados._sum.pontosUsados || 0;
      const saldo = totalGanho - totalGasto;

      if (saldo < recompensa.pontosNecessarios) {
        res.status(400).json({ erro: 'Saldo de pontos insuficiente.' });
        return;
      }

      const resgate = await prisma.resgateRecompensa.create({
        data: {
          clienteId,
          recompensaId,
          barbeariaId,
          pontosUsados: recompensa.pontosNecessarios,
        },
      });

      res.status(201).json(resgate);
    } catch (error) {
      console.error('Erro ao resgatar recompensa:', error);
      res.status(500).json({ erro: 'Erro ao resgatar recompensa.' });
    }
  }
}
