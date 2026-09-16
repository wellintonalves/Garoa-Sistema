import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';
import { prisma } from '../lib/prisma';
import { WebhookAsaasService } from '../services/webhookAsaas.service';
import type { AuthRequest } from '../types';

const router = Router();
// Sem rota financeira de simulação em produção, mesmo com flags acidentais.
router.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'development' || process.env.ASSINATURA_PROVEDOR !== 'fake' || process.env.ASSINATURA_FAKE_LOCAL_ENABLED !== 'true'
    || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '')) {
    res.status(404).json({ erro: 'Recurso indisponível.' }); return;
  }
  next();
});
router.use(authMiddleware, roleMiddleware('ADMIN'));
router.post('/confirmar', async (req: AuthRequest, res, next) => {
  try {
    const checkout = typeof req.body.checkout === 'string' ? req.body.checkout : '';
    const resultado = req.body.resultado;
    if (!checkout || !['aprovado', 'recusado'].includes(resultado)) { res.status(400).json({ erro: 'Escolha um resultado válido para a simulação.' }); return; }
    const admin = await prisma.usuario.findFirst({ where: { id: req.usuario!.id, papel: 'ADMIN', barbeariaId: req.usuario!.barbeariaId }, select: { id: true } });
    if (!admin || !req.usuario!.barbeariaId) { res.status(403).json({ erro: 'Administrador autorizado não encontrado.' }); return; }
    const assinatura = await prisma.assinaturaSaas.findUnique({ where: { barbeariaId: req.usuario!.barbeariaId! } });
    if (!assinatura) { res.status(404).json({ erro: 'Assinatura não encontrada.' }); return; }
    const mudanca = await prisma.mudancaAssinatura.findFirst({ where: { assinaturaId: assinatura.id, checkoutExternoId: checkout } });
    if (assinatura.checkoutExternoId !== checkout && !mudanca) { res.status(404).json({ erro: 'Checkout não encontrado para esta barbearia.' }); return; }
    const aprovado = await prisma.eventoWebhookAsaas.findUnique({ where: { eventoExternoId: `demo-${checkout}-aprovado` } });
    if (resultado === 'recusado' && aprovado?.status === 'PROCESSADO') { res.status(409).json({ erro: 'Este checkout já foi aprovado.' }); return; }
    const referencia = mudanca ? `mudanca:${mudanca.id}` : assinatura.id;
    const unidade = await prisma.barbearia.findUnique({ where: { id: assinatura.barbeariaId }, select: { legadoAssinatura: true } });
    const agora = new Date().toISOString();
    const tipo = resultado === 'recusado' ? 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED' : 'CHECKOUT_PAID';
    const recurso = resultado === 'recusado' ? 'payment' : 'checkout';
    const evento = await WebhookAsaasService.registrar({ id: `demo-${checkout}-${resultado}`, event: tipo, dateCreated: agora,
      [recurso]: { id: checkout, externalReference: referencia, subscription: `demo-sub-${assinatura.id}` } });
    if (evento.eventoId && !evento.duplicado) await WebhookAsaasService.processar(evento.eventoId);
    if (resultado === 'aprovado' && unidade?.legadoAssinatura && !mudanca) {
      const pagamento = await WebhookAsaasService.registrar({ id: `demo-${checkout}-pagamento`, event: 'PAYMENT_CONFIRMED', dateCreated: agora,
        payment: { id: `demo-pay-${checkout}`, externalReference: assinatura.id, subscription: `demo-sub-${assinatura.id}`, dueDate: agora } });
      if (pagamento.eventoId && !pagamento.duplicado) await WebhookAsaasService.processar(pagamento.eventoId);
    }
    res.json({ simulado: true, resultado, mensagem: 'Simulação concluída. Nenhum dinheiro foi movimentado.' });
  } catch (erro) { next(erro); }
});
export default router;
