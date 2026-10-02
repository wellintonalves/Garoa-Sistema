import { Response, NextFunction } from 'express';
import { ClienteAuthRequest } from '../types';
import { validarEscritaAssinatura } from '../services/acessoAssinatura.service';
import { autenticarSessao, dadosCliente } from '../services/sessao.service';
import { tenantStorage } from '../lib/als';
import { prisma } from '../lib/prisma';
import { ErroDeNegocio } from '../lib/erros';

export async function clienteAuthMiddleware(req: ClienteAuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuario = await autenticarSessao(req, res, 'cliente');
    req.cliente = dadosCliente(usuario);
    // Only server route params select a tenant. Headers/body never grant membership.
    const barbeariaId = req.params.barbeariaId || req.originalUrl.match(/\/barbearia\/([^/?]+)/)?.[1];
    if (barbeariaId) {
      const vinculo = await prisma.clienteBarbearia.findFirst({ where: { clienteId: req.cliente.clienteId, barbeariaId, ativo: true, barbearia: { ativo: true } }, select: { id: true } });
      if (!vinculo) throw new ErroDeNegocio('Acesso não permitido a esta barbearia.', 403);
      await validarEscritaAssinatura(barbeariaId, req.method, req.originalUrl);
      tenantStorage.run({ barbeariaId }, next);
    } else next();
  } catch (error) { next(error); }
}
