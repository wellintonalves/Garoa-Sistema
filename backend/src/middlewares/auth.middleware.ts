import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { validarBarbeariaAtiva } from '../services/acessoBarbearia.service';
import { validarEscritaAssinatura } from '../services/acessoAssinatura.service';
import { autenticarSessao, dadosUsuario, portalAutenticacao } from '../services/sessao.service';
import { tenantStorage } from '../lib/als';
import { ErroDeNegocio } from '../lib/erros';

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const portal = portalAutenticacao(req);
    if (!portal) throw new ErroDeNegocio('Sua sessão expirou. Entre novamente para continuar.', 401);
    const usuario = await autenticarSessao(req, res, portal);
    req.usuario = dadosUsuario(usuario);
    if (usuario.barbeariaId) {
      await validarBarbeariaAtiva(usuario.barbeariaId);
      await validarEscritaAssinatura(usuario.barbeariaId, req.method, req.originalUrl);
      tenantStorage.run({ barbeariaId: usuario.barbeariaId }, next);
    } else next();
  } catch (error) { next(error); }
}
