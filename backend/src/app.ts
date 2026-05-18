// Configuração do Express
import express from 'express';
import cors from 'cors';
import routes from './routes';
import { errorMiddleware } from './middlewares/error.middleware';

const app = express();

// CORS — aceita apenas a URL do frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Parse de JSON
app.use(express.json());

// Rota de health check (usada pelo Railway)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Rotas da API
app.use(routes);

// Middleware de erro (deve ser o último)
app.use(errorMiddleware);

export default app;
