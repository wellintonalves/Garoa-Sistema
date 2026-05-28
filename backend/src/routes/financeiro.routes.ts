// Rotas financeiras (protegidas — somente ADMIN)
import { Router } from 'express';
import { FinanceiroController } from '../controllers/financeiro.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN'));

router.get('/', FinanceiroController.listar);
router.get('/relatorio', FinanceiroController.relatorio);
router.get('/resumo-dia', FinanceiroController.resumoDia);
router.get('/ultimos-7-dias', FinanceiroController.ultimos7Dias);
router.post('/', FinanceiroController.criar);
router.put('/:id', FinanceiroController.atualizar);
router.delete('/:id', FinanceiroController.remover);

export default router;
