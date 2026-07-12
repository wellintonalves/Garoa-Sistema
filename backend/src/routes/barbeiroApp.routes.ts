// Rotas do app do barbeiro
import { Router } from 'express';
import { BarbeiroAppController } from '../controllers/barbeiroApp.controller';
import { barbeiroAuthMiddleware } from '../middlewares/barbeiroAuth.middleware';
import { loginLimiter } from '../middlewares/rateLimit.middleware';

const router = Router();

// Rota pública (login)
router.post('/login', loginLimiter, BarbeiroAppController.login);

// Rotas protegidas (requerem token do barbeiro)
router.use(barbeiroAuthMiddleware as never);

router.get('/agenda-hoje', BarbeiroAppController.agendaHoje);
router.get('/agenda', BarbeiroAppController.agenda);
router.get('/comissoes', BarbeiroAppController.comissoes);
router.post('/concluir-agendamento/:id', BarbeiroAppController.concluirAgendamento);
router.get('/perfil', BarbeiroAppController.perfil);
router.patch('/status-trabalho', BarbeiroAppController.atualizarStatusTrabalho);
router.get('/resumo-semana', BarbeiroAppController.resumoSemana);

export default router;
