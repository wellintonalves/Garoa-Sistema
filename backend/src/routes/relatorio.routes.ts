// Rotas de relatórios (protegidas — somente ADMIN)
import { Router } from 'express';
import { RelatorioController } from '../controllers/relatorio.controller';
import { AgendamentoController } from '../controllers/agendamento.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';

const router = Router();

router.use(authMiddleware);

// Relatórios — somente ADMIN
router.get('/resumo', roleMiddleware('ADMIN'), RelatorioController.resumo);

// Agenda do barbeiro — ADMIN e BARBEIRO
router.get('/agenda/:barbeiroId', roleMiddleware('ADMIN', 'BARBEIRO'), AgendamentoController.horarios);

export default router;
