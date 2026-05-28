import { Router } from 'express';
import { PublicoController } from '../controllers/publico.controller';

const router = Router();

router.get('/servicos', PublicoController.listarServicos);
router.get('/barbeiros', PublicoController.listarBarbeiros);
router.get('/horarios-disponiveis', PublicoController.listarHorariosDisponiveis);
router.post('/agendamentos', PublicoController.criarAgendamento);
router.get('/fidelidade', PublicoController.checarFidelidade);

export default router;
