// Configuração do Express
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import routes from './routes';
import { errorMiddleware } from './middlewares/error.middleware';
import checkoutLocalRoutes from './routes/checkoutLocal.routes';
import { origensPermitidas } from './services/sessao.service';

const app = express();

// Logger simples de requisições
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(JSON.stringify({ evento: 'http_resposta', metodo: req.method, status: res.statusCode, duracaoMs: duration }));
  });
  next();
});

app.set('trust proxy', 1);
app.use(helmet());
app.use(helmet.hsts({ maxAge: 15552000 }));
app.use(compression());

const corsOptions = {
  origin: origensPermitidas(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Valen-Client', 'X-Valen-Portal'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Parse de JSON com limite estendido para suportar imagens em Base64
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rota de health check (usada pelo Railway)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Rotas da API
app.use(routes);
app.use('/dev/checkout-local', checkoutLocalRoutes);

// Middleware de erro (deve ser o último)
app.use(errorMiddleware);

export default app;
