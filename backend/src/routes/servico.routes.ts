// Rotas de serviços (protegidas)
import { Router } from 'express';
import { ServicoController } from '../controllers/servico.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', ServicoController.listar);
router.get('/:id', ServicoController.buscar);
router.post('/', roleMiddleware('ADMIN'), ServicoController.criar);
router.put('/:id', roleMiddleware('ADMIN'), ServicoController.atualizar);
router.delete('/:id', roleMiddleware('ADMIN'), ServicoController.desativar);

export default router;
