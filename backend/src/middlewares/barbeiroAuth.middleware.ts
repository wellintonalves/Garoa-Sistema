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

    if (decoded.barbeariaId) {
      const { tenantStorage } = require('../lib/als');
      tenantStorage.run({ barbeariaId: decoded.barbeariaId }, () => {
        next();
      });
    } else {
      // Se por acaso não tiver (legacy), busca no banco
      const { prisma } = require('../lib/prisma');
      prisma.barbeiro.findUnique({ where: { id: decoded.barbeiroId }, select: { barbeariaId: true } })
        .then((b: any) => {
          if (b?.barbeariaId) {
            const { tenantStorage } = require('../lib/als');
            tenantStorage.run({ barbeariaId: b.barbeariaId }, () => next());
          } else {
            next();
          }
        })
        .catch(() => next());
    }
  } catch {
    res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}
