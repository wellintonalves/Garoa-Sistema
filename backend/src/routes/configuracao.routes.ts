import { Router } from 'express';
import { ConfiguracaoController } from '../controllers/configuracao.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';

const router = Router();

// Todas as rotas de configuração exigem autenticação e privilégio de ADMIN
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN'));

router.get('/', ConfiguracaoController.obter);
router.put('/', ConfiguracaoController.atualizar);

router.get('/minha-barbearia', ConfiguracaoController.getMinhaBarbearia);
router.put('/minha-barbearia', ConfiguracaoController.updateMinhaBarbearia);

export default router;
