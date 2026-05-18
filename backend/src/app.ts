// Configuração do Express
import express from 'express';
import cors from 'cors';
import routes from './routes';
import { errorMiddleware } from './middlewares/error.middleware';

const app = express();

// CORS — aceita frontend local e Railway
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Permite requisições sem origin (Postman, curl, health checks)
    if (!origin) return callback(null, true);
    // Permite origens configuradas
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Permite qualquer subdomínio do Railway
    if (origin.endsWith('.up.railway.app')) return callback(null, true);
    callback(new Error('Bloqueado pelo CORS'));
  },
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
