// Rotas de estoque (protegidas — somente ADMIN)
import { Router } from 'express';
import { EstoqueController } from '../controllers/estoque.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN'));

// Listagens e KPIs (ordem importa — rotas específicas antes de /:id)
router.get('/', EstoqueController.listar);
router.get('/kpis', EstoqueController.kpis);
router.get('/baixo', EstoqueController.estoqueBaixo);
router.get('/vendas', EstoqueController.listarVendas);

// CRUD por ID
router.get('/:id', EstoqueController.buscar);
router.post('/', EstoqueController.criar);
router.put('/:id', EstoqueController.atualizar);
router.delete('/:id', EstoqueController.remover);

// Venda de produto
router.post('/:id/vender', EstoqueController.vender);

export default router;
