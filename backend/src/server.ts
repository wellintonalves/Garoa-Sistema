// Entry point do servidor
import dotenv from 'dotenv';
dotenv.config();

import app from './app';

process.on('uncaughtException', (err) => {
  console.error('❌ uncaughtException:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ unhandledRejection:', reason);
});

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, () => {
  console.log(`🏪 Servidor da barbearia rodando na porta ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});
