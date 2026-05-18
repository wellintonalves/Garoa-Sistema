// Rotas de barbeiros (protegidas)
import { Router } from 'express';
import { BarbeiroController } from '../controllers/barbeiro.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', BarbeiroController.listar);
router.get('/:id', BarbeiroController.buscar);
router.post('/', roleMiddleware('ADMIN'), BarbeiroController.criar);
router.put('/:id', roleMiddleware('ADMIN'), BarbeiroController.atualizar);
router.delete('/:id', roleMiddleware('ADMIN'), BarbeiroController.desativar);

export default router;
