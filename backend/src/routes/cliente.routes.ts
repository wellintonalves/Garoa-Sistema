// Rotas de clientes (protegidas)
import { Router } from 'express';
import { ClienteController } from '../controllers/cliente.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';

const router = Router();

router.use(authMiddleware);

// Rotas específicas ANTES das rotas com :id para evitar conflito
router.get('/resumo', roleMiddleware('ADMIN', 'BARBEIRO'), ClienteController.resumo);
router.get('/aniversariantes', roleMiddleware('ADMIN', 'BARBEIRO'), ClienteController.aniversariantes);

// CRUD
router.get('/', roleMiddleware('ADMIN', 'BARBEIRO'), ClienteController.listar);
router.get('/:id', roleMiddleware('ADMIN', 'BARBEIRO'), ClienteController.buscar);
router.post('/', roleMiddleware('ADMIN'), ClienteController.criar);
router.put('/:id', roleMiddleware('ADMIN'), ClienteController.atualizar);
router.delete('/:id', roleMiddleware('ADMIN'), ClienteController.remover);

// Fidelidade — admin actions
router.post('/:id/pontos', roleMiddleware('ADMIN'), ClienteController.adicionarPontos);
router.post('/:id/resgatar/:recompensaId', roleMiddleware('ADMIN'), ClienteController.resgatarRecompensa);

export default router;
