// Middleware de autenticação JWT
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authConfig } from '../config/auth';
import { AuthRequest, UsuarioJWT } from '../types';

/** Verifica se o token JWT é válido e anexa dados do usuário ao request */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
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
    const decoded = jwt.verify(token, authConfig.secret) as UsuarioJWT;
    req.usuario = decoded;

    // Se houver barbeariaId, injeta no contexto async para RLS
    if (decoded.barbeariaId) {
      const { tenantStorage } = require('../lib/als');
      tenantStorage.run({ barbeariaId: decoded.barbeariaId }, () => {
        next();
      });
    } else {
      next();
    }
  } catch {
    // Tenta validar como token de barbeiro (necessário pois barbeiros acessam rotas protegidas como /bloqueios)
    try {
      const decodedBarbeiro = jwt.verify(token, authConfig.secretBarbeiro) as any;
      
      if (decodedBarbeiro.barbeiroId) {
        req.usuario = {
          id: decodedBarbeiro.usuarioId,
          nome: decodedBarbeiro.nome,
          email: decodedBarbeiro.email,
          papel: 'BARBEIRO',
          barbeariaId: decodedBarbeiro.barbeariaId
        } as UsuarioJWT;

        if (decodedBarbeiro.barbeariaId) {
          const { tenantStorage } = require('../lib/als');
          tenantStorage.run({ barbeariaId: decodedBarbeiro.barbeariaId }, () => {
            next();
          });
        } else {
          // Fallback legacy
          const { prisma } = require('../lib/prisma');
          prisma.barbeiro.findUnique({ where: { id: decodedBarbeiro.barbeiroId }, select: { barbeariaId: true } })
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
      } else {
        throw new Error('Não é um token de barbeiro válido');
      }
    } catch {
      res.status(401).json({ erro: 'Token inválido ou expirado' });
    }
  }
}
