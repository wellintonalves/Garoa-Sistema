import { Request, Response } from 'express';
import { AprovacaoService } from '../services/aprovacao.service';
import { BarbeiroAuthRequest } from '../types';

export class AprovacaoController {
  static async listarPendentes(req: BarbeiroAuthRequest, res: Response): Promise<void> {
    try {
      const barbeiroId = req.barbeiro?.barbeiroId;
      if (!barbeiroId) {
        res.status(403).json({ erro: 'Usuário não é um barbeiro.' });
        return;
      }
      
      const aprovacoes = await AprovacaoService.listarPendentes(barbeiroId);
      res.json(aprovacoes);
    } catch (erro: any) {
      res.status(400).json({ erro: erro.message });
    }
  }

  static async aprovar(req: BarbeiroAuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const barbeiroId = req.barbeiro?.barbeiroId;
      if (!barbeiroId) {
        res.status(403).json({ erro: 'Usuário não é um barbeiro.' });
        return;
      }

      const aprovacao = await AprovacaoService.aprovar(id, barbeiroId);
      res.json(aprovacao);
    } catch (erro: any) {
      res.status(400).json({ erro: erro.message });
    }
  }

  static async rejeitar(req: BarbeiroAuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const barbeiroId = req.barbeiro?.barbeiroId;
      if (!barbeiroId) {
        res.status(403).json({ erro: 'Usuário não é um barbeiro.' });
        return;
      }

      const aprovacao = await AprovacaoService.rejeitar(id, barbeiroId);
      res.json(aprovacao);
    } catch (erro: any) {
      res.status(400).json({ erro: erro.message });
    }
  }
}
