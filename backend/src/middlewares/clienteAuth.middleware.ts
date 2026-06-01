// Middleware de autenticação JWT para clientes
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authConfig } from '../config/auth';
import { ClienteAuthRequest, ClienteJWT } from '../types';

/** Verifica se o token JWT do cliente é válido */
export function clienteAuthMiddleware(req: ClienteAuthRequest, res: Response, next: NextFunction): void {
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
    const decoded = jwt.verify(token, authConfig.secretCliente) as ClienteJWT;
    req.cliente = decoded;
    next();
  } catch {
    res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}
