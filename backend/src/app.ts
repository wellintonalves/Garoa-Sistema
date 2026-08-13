// Configuração do Express
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import routes from './routes';
import { errorMiddleware } from './middlewares/error.middleware';

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(helmet.hsts({ maxAge: 15552000 }));
app.use(compression());

const allowedOrigins = [
  'https://valenbarber.com.br',
  'https://barbearia-frontend-production-bb18.up.railway.app',
  'http://localhost:5173',
  'http://192.168.15.6:5173'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin.match(/^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|localhost)/)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
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
