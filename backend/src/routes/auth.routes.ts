// Rotas de autenticação (públicas)
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { loginLimiter, registerLimiter } from '../middlewares/rateLimit.middleware';

const router = Router();

router.post('/login', loginLimiter, AuthController.login);
router.post('/register', registerLimiter, AuthController.registrar);

export default router;
