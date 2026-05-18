// Middleware de autorização por papel do usuário
import { Response, NextFunction } from 'express';
import { Papel } from '@prisma/client';
import { AuthRequest } from '../types';

/** Verifica se o usuário tem um dos papéis permitidos */
export function roleMiddleware(...papeisPermitidos: Papel[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.usuario) {
      res.status(401).json({ erro: 'Usuário não autenticado' });
      return;
    }

    if (!papeisPermitidos.includes(req.usuario.papel)) {
      res.status(403).json({ erro: 'Você não tem permissão para acessar este recurso' });
      return;
    }

    next();
  };
}
