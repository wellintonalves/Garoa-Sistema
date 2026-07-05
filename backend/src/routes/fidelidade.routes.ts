import { Router } from 'express';
import { FidelidadeController } from '../controllers/fidelidade.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN'));

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
router.patch('/resgates/:id/confirmar', FidelidadeController.confirmarResgate);
router.patch('/resgates/:id/cancelar', FidelidadeController.cancelarResgate);

// Pontos — ajuste manual e histórico por cliente
router.post('/ajuste/:clienteId', FidelidadeController.ajustarPontos);
router.get('/historico/:clienteId', FidelidadeController.historicoCliente);
router.get('/clientes', FidelidadeController.listarClientesComPontos);

export default router;
