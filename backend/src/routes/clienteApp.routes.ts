// Rotas do app do cliente
import { Router } from 'express';
import { ClienteAppController } from '../controllers/clienteApp.controller';
import { clienteAuthMiddleware } from '../middlewares/clienteAuth.middleware';

const router = Router();

// Rotas públicas (sem autenticação)
router.post('/register', ClienteAppController.registrar);
router.post('/login', ClienteAppController.login);

// Rotas protegidas (requerem token do cliente)
router.use(clienteAuthMiddleware as never);

router.get('/buscar-barbearia', ClienteAppController.buscarBarbearia);
router.get('/buscar-barbearia-slug/:slug', ClienteAppController.buscarBarbeariaPorSlug);
router.post('/conectar-barbearia', ClienteAppController.conectarBarbearia);
router.delete('/desconectar-barbearia/:barbeariaId', ClienteAppController.desconectarBarbearia);
router.get('/minhas-barbearias', ClienteAppController.minhasBarbearias);
router.get('/perfil', ClienteAppController.perfil);
router.put('/perfil', ClienteAppController.atualizarPerfil);

// Rotas de barbearia específica
router.get('/barbearia/:barbeariaId/agendamentos', ClienteAppController.agendamentos);
router.get('/barbearia/:barbeariaId/servicos', ClienteAppController.servicos);
router.get('/barbearia/:barbeariaId/barbeiros', ClienteAppController.barbeiros);
router.get('/barbearia/:barbeariaId/horarios-disponiveis', ClienteAppController.horariosDisponiveis);
router.post('/barbearia/:barbeariaId/agendar', ClienteAppController.agendar);
router.get('/barbearia/:barbeariaId/fidelidade', ClienteAppController.fidelidade);
router.post('/barbearia/:barbeariaId/fidelidade/resgatar', ClienteAppController.resgatarRecompensa);

export default router;
