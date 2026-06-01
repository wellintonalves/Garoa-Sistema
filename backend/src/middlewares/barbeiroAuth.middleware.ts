// Middleware de autenticação JWT para barbeiros
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authConfig } from '../config/auth';
import { BarbeiroAuthRequest, BarbeiroJWT } from '../types';

/** Verifica se o token JWT do barbeiro é válido */
export function barbeiroAuthMiddleware(req: BarbeiroAuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ erro: 'Token não fornecido' });
    return;
  }

  const partes = authHeader.split(' ');

  if (partes.length !== 2 || partes[0] !== 'Bearer') {
    res.status(401).json({ erro: 'Formato de token inválido' });
    return;
  }

  const token = partes[1];

  try {
    const decoded = jwt.verify(token, authConfig.secretBarbeiro) as BarbeiroJWT;
    req.barbeiro = decoded;
    next();
  } catch {
    res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}
