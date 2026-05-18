// Rotas de agendamentos (protegidas)
import { Router } from 'express';
import { AgendamentoController } from '../controllers/agendamento.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', roleMiddleware('ADMIN', 'BARBEIRO'), AgendamentoController.listar);
router.get('/:id', roleMiddleware('ADMIN', 'BARBEIRO'), AgendamentoController.buscar);
router.post('/', roleMiddleware('ADMIN', 'BARBEIRO'), AgendamentoController.criar);
router.put('/:id', roleMiddleware('ADMIN', 'BARBEIRO'), AgendamentoController.atualizar);
router.delete('/:id', roleMiddleware('ADMIN'), AgendamentoController.cancelar);

export default router;
