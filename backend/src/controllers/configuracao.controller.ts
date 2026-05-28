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
}
