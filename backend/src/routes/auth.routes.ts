import { rotasSessao } from './sessao.routes';
import { protegerEntradaSessao } from '../services/sessao.service';
// Rotas de autenticação (públicas)
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { loginLimiter, registerLimiter } from '../middlewares/rateLimit.middleware';

const router = Router();
router.use(rotasSessao('admin'));

router.post('/login', protegerEntradaSessao, loginLimiter, AuthController.login);
router.post('/register', protegerEntradaSessao, registerLimiter, AuthController.registrar);

export default router;
