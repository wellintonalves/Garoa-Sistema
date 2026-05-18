// Rotas de clientes (protegidas)
import { Router } from 'express';
import { ClienteController } from '../controllers/cliente.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', roleMiddleware('ADMIN', 'BARBEIRO'), ClienteController.listar);
router.get('/:id', roleMiddleware('ADMIN', 'BARBEIRO'), ClienteController.buscar);
router.post('/', roleMiddleware('ADMIN'), ClienteController.criar);
router.put('/:id', roleMiddleware('ADMIN'), ClienteController.atualizar);
router.delete('/:id', roleMiddleware('ADMIN'), ClienteController.remover);

export default router;
