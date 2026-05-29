import { Response } from 'express';
import { ConfiguracaoService } from '../services/configuracao.service';
import { AuthRequest } from '../types';

export class ConfiguracaoController {
  /** GET /configuracoes */
  static async obter(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const config = await ConfiguracaoService.obter();
      res.json(config);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao obter configurações';
      res.status(500).json({ erro: msg });
    }
  }

  /** PUT /configuracoes */
  static async atualizar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const config = await ConfiguracaoService.atualizar(req.body);
      res.json(config);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao atualizar configurações';
      res.status(400).json({ erro: msg });
    }
  }

  /** GET /configuracoes/minha-barbearia */
  static async getMinhaBarbearia(req: AuthRequest, res: Response): Promise<void> {
    try {
      const barbeariaId = req.usuario?.barbeariaId;
      if (!barbeariaId) { res.status(401).json({ erro: 'Não autorizado' }); return; }

      const { prisma } = require('../lib/prisma');
      const barbearia = await prisma.barbearia.findUnique({ where: { id: barbeariaId } });
      const clientesCount = await prisma.cliente.count({ where: { barbeariaId } });

      res.json({ ...barbearia, clientesCount });
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao buscar dados da barbearia' });
    }
  }

  /** PUT /configuracoes/minha-barbearia */
  static async updateMinhaBarbearia(req: AuthRequest, res: Response): Promise<void> {
    try {
      const barbeariaId = req.usuario?.barbeariaId;
      if (!barbeariaId) { res.status(401).json({ erro: 'Não autorizado' }); return; }

      const { nome, slug, corPrimaria, endereco, telefone } = req.body;
      const { prisma } = require('../lib/prisma');

      const barbearia = await prisma.barbearia.update({
        where: { id: barbeariaId },
        data: { nome, slug, corPrimaria, endereco, telefone }
      });

      res.json(barbearia);
    } catch (error) {
      res.status(400).json({ erro: 'Erro ao atualizar barbearia. Slug pode já estar em uso.' });
    }
  }
}
