import { Router } from 'express';
import { TenantController } from '../controllers/tenantController';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Dados públicos
router.get('/:slug', TenantController.getBarbearia);
router.get('/:slug/identidade', TenantController.getIdentidade);
router.get('/:slug/servicos', TenantController.getServicos);
router.get('/:slug/barbeiros', TenantController.getBarbeiros);
router.get('/:slug/horarios-disponiveis', TenantController.getHorariosDisponiveis);

// Autenticação de Clientes
router.post('/:slug/auth/register', TenantController.registerClient);
router.post('/:slug/auth/login', TenantController.loginClient);

// Rotas do App do Cliente (requerem token)
router.use('/:slug/app', authMiddleware);
router.get('/:slug/app/meus-agendamentos', TenantController.meusAgendamentos);
router.get('/:slug/app/minha-fidelidade', TenantController.minhaFidelidade);

// Como o agendamento pode ser logado ou anônimo (depende do caso de uso),
// se o cliente estiver logado, passamos o authMiddleware (opcionalmente)
// Vou criar uma rota específica para agendar dentro do /app (logado)
router.post('/:slug/app/agendar', TenantController.agendar);

// E uma rota anônima mantendo comportamento antigo (caso precise)
router.post('/:slug/agendar', TenantController.agendar);

export default router;
