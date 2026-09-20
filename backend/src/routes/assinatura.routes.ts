import { Router } from 'express';
import { AssinaturaController } from '../controllers/assinatura.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';

const router = Router();

router.post('/webhooks/asaas', AssinaturaController.receberWebhookAsaas);

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN'));

router.get('/', AssinaturaController.obterResumo);
router.get('/regularizacao', AssinaturaController.obterRegularizacao);
router.post('/cartao-da-cobranca', AssinaturaController.usarCartaoDaCobranca);
router.post('/aviso-pagamento', AssinaturaController.registrarAvisoPagamento);
router.post('/transicao-legado/aviso', AssinaturaController.registrarAvisoLegado);
router.post('/contratacao', AssinaturaController.iniciarContratacao);
router.post('/mudancas', AssinaturaController.solicitarMudanca);
router.get('/cancelamento', AssinaturaController.obterCancelamento);
router.get('/exportacao', AssinaturaController.exportarDados);
router.post('/cancelamento', AssinaturaController.solicitarCancelamento);

export default router;
