import { Router } from 'express';
import { BloqueioController } from '../controllers/bloqueio.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Todas as rotas de bloqueio requerem autenticação (Barbeiro ou Admin)
router.use(authMiddleware);

router.post('/', BloqueioController.criar);
router.get('/', BloqueioController.listar);
router.delete('/:id', BloqueioController.remover);

export { router as bloqueioRoutes };
