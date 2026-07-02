// Rotas de autenticação (públicas)
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { loginLimiter } from '../middlewares/rateLimit.middleware';

const router = Router();

router.post('/login', loginLimiter, AuthController.login);
router.post('/register', AuthController.registrar);

export default router;
