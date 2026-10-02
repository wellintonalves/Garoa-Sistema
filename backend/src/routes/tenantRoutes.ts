import { rotasSessao } from './sessao.routes';
import { protegerEntradaSessao } from '../services/sessao.service';
import { loginLimiter, registerLimiter } from '../middlewares/rateLimit.middleware';
import { Router } from 'express';
import { TenantController } from '../controllers/tenantController';
import { roleMiddleware } from '../middlewares/role.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
router.use('/auth', rotasSessao('tenant'));

// Dados públicos
router.get('/:slug', TenantController.getBarbearia);
router.get('/:slug/identidade', TenantController.getIdentidade);
router.get('/:slug/servicos', TenantController.getServicos);
router.get('/:slug/barbeiros', TenantController.getBarbeiros);
router.get('/:slug/horarios-disponiveis', TenantController.getHorariosDisponiveis);

// Autenticação de Clientes
router.post('/:slug/auth/register', protegerEntradaSessao, registerLimiter, TenantController.registerClient);
router.post('/:slug/auth/login', protegerEntradaSessao, loginLimiter, TenantController.loginClient);

// Rotas do App do Cliente (requerem token)
router.use('/:slug/app', authMiddleware, roleMiddleware('CLIENTE'));
router.get('/:slug/app/meus-agendamentos', TenantController.meusAgendamentos);
router.get('/:slug/app/minha-fidelidade', TenantController.minhaFidelidade);

// Identidade autenticada também é obrigatória nos aliases legados.
router.post('/:slug/app/agendar', TenantController.agendar);

router.post('/:slug/agendar', authMiddleware, roleMiddleware('CLIENTE'), TenantController.agendar);

export default router;
