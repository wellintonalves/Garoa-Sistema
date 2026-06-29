import { Router } from 'express';
import { AprovacaoController } from '../controllers/aprovacao.controller';
import { barbeiroAuthMiddleware } from '../middlewares/barbeiroAuth.middleware';

const router = Router();

router.use(barbeiroAuthMiddleware as never);

router.get('/pendentes', AprovacaoController.listarPendentes);
router.post('/:id/aprovar', AprovacaoController.aprovar);
router.post('/:id/rejeitar', AprovacaoController.rejeitar);

export default router;
