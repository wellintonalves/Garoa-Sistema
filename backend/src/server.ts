// Entry point do servidor
import dotenv from 'dotenv';
dotenv.config();

import app from './app';

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, () => {
  console.log(`🏪 Servidor da barbearia rodando na porta ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});
