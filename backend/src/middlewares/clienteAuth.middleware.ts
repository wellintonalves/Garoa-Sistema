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

    // Tenta encontrar o barbeariaId no payload (se existir no futuro), headers, body ou extraindo da URL
    const barbeariaId = (decoded as any).barbeariaId || 
                        req.headers['x-barbearia-id'] || 
                        req.params.barbeariaId || 
                        req.body?.barbeariaId ||
                        req.originalUrl.match(/\/barbearia\/([^\/?]+)/)?.[1];

    if (barbeariaId && typeof barbeariaId === 'string') {
      const { tenantStorage } = require('../lib/als');
      tenantStorage.run({ barbeariaId }, () => next());
    } else {
      next();
    }
  } catch {
    res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}
