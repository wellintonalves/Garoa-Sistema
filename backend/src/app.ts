// Configuração do Express
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import routes from './routes';
import { errorMiddleware } from './middlewares/error.middleware';

const app = express();

// Logger simples de requisições
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${req.method}] ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

app.set('trust proxy', 1);
app.use(helmet());
app.use(helmet.hsts({ maxAge: 15552000 }));
app.use(compression());

const extras = (process.env.CORS_EXTRA_ORIGINS ?? '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const allowedOrigins = [
  'https://valenbarber.com.br',
  'https://barbearia-frontend-production-bb18.up.railway.app',
  'http://localhost:5173',
  ...extras
];

console.log('🌍 CORS configurado para as origens:', allowedOrigins);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());

// Parse de JSON com limite estendido para suportar imagens em Base64
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rota de health check (usada pelo Railway)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Rotas da API
app.use(routes);

// Middleware de erro (deve ser o último)
app.use(errorMiddleware);

export default app;
