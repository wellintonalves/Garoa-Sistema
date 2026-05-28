import { Router } from 'express';
import { ConfiguracaoController } from '../controllers/configuracao.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Todas as rotas de configuração exigem autenticação
router.use(authMiddleware);

router.get('/', ConfiguracaoController.obter);
router.put('/', ConfiguracaoController.atualizar);

export default router;
