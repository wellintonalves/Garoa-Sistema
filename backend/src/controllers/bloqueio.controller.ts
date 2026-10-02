import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { BloqueioService } from '../services/bloqueio.service';
import { objetoPermitido } from '../utils/entradaSegura.util';

export class BloqueioController {
  static async criar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      objetoPermitido(req.body, ['barbeiroId', 'dataInicio', 'dataFim', 'motivo']);
      const { barbeiroId, dataInicio, dataFim, motivo } = req.body;
      const bloqueio = await BloqueioService.criar(barbeiroId, dataInicio, dataFim, motivo, req.usuario!);
      res.status(201).json(bloqueio);
    } catch (error) { next(error); }
  }

  static async listar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const barbeiroId = typeof req.query.barbeiroId === 'string' ? req.query.barbeiroId : undefined;
      const aPartirDe = req.query.aPartirDeHoje === 'true' ? new Date() : undefined;
      res.json(await BloqueioService.listar({ barbeiroId, aPartirDe }, req.usuario!));
    } catch (error) { next(error); }
  }

  static async remover(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await BloqueioService.remover(req.params.id as string, req.usuario!);
      res.status(204).send();
    } catch (error) { next(error); }
  }
}
