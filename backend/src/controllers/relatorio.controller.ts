// Controller de relatórios
import { Response } from 'express';
import { RelatorioService } from '../services/relatorio.service';
import { AuthRequest } from '../types';

export class RelatorioController {
  /** GET /relatorios/resumo?inicio=YYYY-MM-DD&fim=YYYY-MM-DD */
  static async resumo(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { inicio, fim } = req.query;

      if (!inicio || !fim) {
        res.status(400).json({ erro: 'Parâmetros inicio e fim são obrigatórios (YYYY-MM-DD)' });
        return;
      }

      const resumo = await RelatorioService.resumo(inicio as string, fim as string);
      res.json(resumo);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao gerar relatório';
      res.status(500).json({ erro: msg });
    }
  }
}
