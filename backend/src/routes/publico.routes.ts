import { Router } from 'express';
import { clienteAuthMiddleware } from '../middlewares/clienteAuth.middleware';
import { PublicoController } from '../controllers/publico.controller';

const router = Router();

router.get('/barbearia/slug/:slug', PublicoController.buscarBarbeariaPorSlug);
router.get('/servicos', PublicoController.listarServicos);
router.get('/barbeiros', PublicoController.listarBarbeiros);
router.get('/horarios-disponiveis', PublicoController.listarHorariosDisponiveis);
router.post('/agendamentos', clienteAuthMiddleware, PublicoController.criarAgendamento);
router.get('/fidelidade', clienteAuthMiddleware, PublicoController.checarFidelidade);

export default router;
