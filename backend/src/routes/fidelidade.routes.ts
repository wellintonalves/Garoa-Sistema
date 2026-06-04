import { Router } from 'express';
import { FidelidadeController } from '../controllers/fidelidade.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

// Configuração
router.get('/configuracao', FidelidadeController.obterConfiguracao);
router.put('/configuracao', FidelidadeController.atualizarConfiguracao);

// Recompensas
router.get('/recompensas', FidelidadeController.listarRecompensas);
router.post('/recompensas', FidelidadeController.criarRecompensa);
router.put('/recompensas/:id', FidelidadeController.atualizarRecompensa);
router.delete('/recompensas/:id', FidelidadeController.removerRecompensa);

// Resgates
router.get('/resgates', FidelidadeController.listarResgates);
router.post('/resgatar/:clienteId/:recompensaId', FidelidadeController.resgatarRecompensa);

export default router;
