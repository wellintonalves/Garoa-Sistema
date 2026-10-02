import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { autenticarSessao, dadosBarbeiro, dadosCliente, dadosUsuario, limparCookieSessao, Portal, protegerEntradaSessao } from '../services/sessao.service';

export function rotasSessao(portal: Portal): Router {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/session', async (req, res, next) => {
    try {
      const u = await autenticarSessao(req, res, portal);
      res.json(portal === 'cliente' ? { cliente: dadosCliente(u) } : portal === 'barbeiro' ? { barbeiro: dadosBarbeiro(u) } : { usuario: dadosUsuario(u), slug: u.barbearia?.slug });
    } catch (error) { next(error); }
  });
  router.post('/logout', protegerEntradaSessao, async (req, res, next) => {
    try {
      try {
        const u = await autenticarSessao(req, res, portal, false);
        // Logout invalidates all sessions of this identity, across replicas and devices.
        await prisma.$executeRaw`UPDATE usuarios SET "authVersion" = "authVersion" + 1 WHERE id = ${u.id}`;
      } catch (error) {
        if (!(error instanceof Error && 'status' in error && error.status === 401)) throw error;
      }
      limparCookieSessao(res, portal);
      res.status(204).end();
    } catch (error) { next(error); }
  });
  return router;
}
