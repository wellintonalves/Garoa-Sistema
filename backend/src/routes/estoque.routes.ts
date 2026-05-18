// Rotas de estoque (protegidas — somente ADMIN)
import { Router } from 'express';
import { EstoqueController } from '../controllers/estoque.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN'));

router.get('/', EstoqueController.listar);
router.get('/baixo', EstoqueController.estoqueBaixo);
router.get('/:id', EstoqueController.buscar);
router.post('/', EstoqueController.criar);
router.put('/:id', EstoqueController.atualizar);
router.delete('/:id', EstoqueController.remover);

export default router;
