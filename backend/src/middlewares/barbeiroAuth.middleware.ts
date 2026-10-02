import { Response, NextFunction } from 'express';
import { BarbeiroAuthRequest } from '../types';
import { validarBarbeariaAtiva } from '../services/acessoBarbearia.service';
import { validarEscritaAssinatura } from '../services/acessoAssinatura.service';
import { autenticarSessao, dadosBarbeiro } from '../services/sessao.service';
import { tenantStorage } from '../lib/als';

export async function barbeiroAuthMiddleware(req: BarbeiroAuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuario = await autenticarSessao(req, res, 'barbeiro');
    req.barbeiro = dadosBarbeiro(usuario);
    await validarBarbeariaAtiva(req.barbeiro.barbeariaId);
    await validarEscritaAssinatura(req.barbeiro.barbeariaId, req.method, req.originalUrl);
    tenantStorage.run({ barbeariaId: req.barbeiro.barbeariaId }, next);
  } catch (error) { next(error); }
}
