import { rotasSessao } from './sessao.routes';
import { protegerEntradaSessao } from '../services/sessao.service';
// Rotas do app do barbeiro
import { Router } from 'express';
import { uploadImagem } from '../middlewares/upload.middleware';
import { BarbeiroAppController } from '../controllers/barbeiroApp.controller';
import { barbeiroAuthMiddleware } from '../middlewares/barbeiroAuth.middleware';
import { loginLimiter } from '../middlewares/rateLimit.middleware';

const router = Router();
router.use(rotasSessao('barbeiro'));

// Rota pública (login)
router.post('/login', protegerEntradaSessao, loginLimiter, BarbeiroAppController.login);

// Rotas protegidas (requerem token do barbeiro)
router.use(barbeiroAuthMiddleware as never);

router.get('/agenda-hoje', BarbeiroAppController.agendaHoje);
router.get('/agenda', BarbeiroAppController.agenda);
router.get('/comissoes', BarbeiroAppController.comissoes);
router.post('/concluir-agendamento/:id', BarbeiroAppController.concluirAgendamento);
router.get('/perfil', BarbeiroAppController.perfil);
router.put('/perfil', BarbeiroAppController.atualizarPerfil);
router.post('/foto', ...uploadImagem, BarbeiroAppController.uploadFoto);
router.patch('/status-trabalho', BarbeiroAppController.atualizarStatusTrabalho);
router.get('/resumo-semana', BarbeiroAppController.resumoSemana);

export default router;
