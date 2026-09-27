import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { barbeiroAuthMiddleware } from '../middlewares/barbeiroAuth.middleware';
import { clienteAuthMiddleware } from '../middlewares/clienteAuth.middleware';
import { AuthRequest, BarbeiroAuthRequest, ClienteAuthRequest } from '../types';
import { prisma } from '../lib/prisma';
import { validarBarbeariaAtiva } from '../services/acessoBarbearia.service';
import { validarEscritaAssinatura } from '../services/acessoAssinatura.service';
import { tenantStorage } from '../lib/als';
import { statusIa } from '../services/ia/politica';
import { ContextoIa } from '../services/ia/cotas';

type Resolver = (req: Request) => Promise<ContextoIa | null>;

export function criarRotasIa(resolver: Resolver) {
  const router = Router({ mergeParams: true });
  router.use(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contexto = await resolver(req);
      if (!contexto) { res.status(403).json({ erro: 'Acesso não permitido a esta barbearia.' }); return; }
      await validarBarbeariaAtiva(contexto.barbeariaId);
      await validarEscritaAssinatura(contexto.barbeariaId, req.method, req.originalUrl);
      res.locals.contextoIa = contexto;
      res.setHeader('Cache-Control', 'no-store');
      tenantStorage.run({ barbeariaId: contexto.barbeariaId }, next);
    } catch (erro) { next(erro); }
  });
  router.get('/status', async (_req, res, next) => {
    try {
      const contexto = res.locals.contextoIa as ContextoIa;
      const assinatura = await prisma.assinaturaSaas.findUnique({
        where: { barbeariaId: contexto.barbeariaId }, select: { plano: true },
      });
      res.json(statusIa(assinatura?.plano ?? null));
    } catch (erro) { next(erro); }
  });
  // Bloqueio incondicional: nem configuração completa contorna a falta de ledger.
  // Não emitir tokens efêmeros nem abrir conexões faturáveis de voz nesta etapa.
  router.post(['/mensagens', '/voz/sessoes'], (_req, res) => {
    res.status(503).json({ codigo: 'IA_EM_PREPARACAO', erro: 'A assistente ainda não está disponível para consumo.' });
  });
  return router;
}

const router = Router();
router.use('/admin', authMiddleware, criarRotasIa(async (req: AuthRequest) => {
  const token = req.usuario;
  if (!token?.barbeariaId || token.papel !== 'ADMIN') return null;
  const usuario = await prisma.usuario.findFirst({ where: { id: token.id, barbeariaId: token.barbeariaId, papel: 'ADMIN' }, select: { id: true } });
  return usuario ? { barbeariaId: token.barbeariaId, usuarioId: usuario.id, papel: 'ADMIN' } : null;
}));
router.use('/barbeiro', barbeiroAuthMiddleware, criarRotasIa(async (req: BarbeiroAuthRequest) => {
  const token = req.barbeiro;
  if (!token?.barbeariaId) return null;
  const barbeiro = await prisma.barbeiro.findFirst({ where: { id: token.barbeiroId, usuarioId: token.usuarioId, barbeariaId: token.barbeariaId, ativo: true }, select: { usuarioId: true } });
  return barbeiro ? { barbeariaId: token.barbeariaId, usuarioId: barbeiro.usuarioId, papel: 'BARBEIRO' } : null;
}));
router.use('/cliente/:barbeariaId', clienteAuthMiddleware, criarRotasIa(async (req: ClienteAuthRequest) => {
  const token = req.cliente;
  const barbeariaId = req.params.barbeariaId;
  if (!token?.clienteId || !token.usuarioId || typeof barbeariaId !== 'string') return null;
  // URL seleciona tenant, mas não concede acesso. Conferir vínculo e identidade.
  const vinculo = await prisma.clienteBarbearia.findFirst({
    where: { barbeariaId, clienteId: token.clienteId, ativo: true, cliente: { usuarioId: token.usuarioId } },
    select: { clienteId: true },
  });
  return vinculo ? { barbeariaId, usuarioId: token.usuarioId, clienteId: token.clienteId, papel: 'CLIENTE' } : null;
}));
export default router;
