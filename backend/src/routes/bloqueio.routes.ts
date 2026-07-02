import { Router } from 'express';
import { BloqueioController } from '../controllers/bloqueio.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';

const router = Router();

// Todas as rotas de bloqueio requerem autenticação (Barbeiro ou Admin)
router.use(authMiddleware);

router.post('/', roleMiddleware('ADMIN', 'BARBEIRO'), BloqueioController.criar);
router.get('/', roleMiddleware('ADMIN', 'BARBEIRO'), BloqueioController.listar);
router.delete('/:id', roleMiddleware('ADMIN', 'BARBEIRO'), BloqueioController.remover);

export { router as bloqueioRoutes };
