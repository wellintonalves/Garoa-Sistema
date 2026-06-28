// Rotas de chat (admin)
import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware as never);

router.get('/nao-lidas', ChatController.totalNaoLidas);
router.get('/conversas', ChatController.listarConversas);
router.get('/conversas/:clienteId', ChatController.adminGetMensagens);
router.post('/conversas/:clienteId', ChatController.adminEnviar);

export default router;
