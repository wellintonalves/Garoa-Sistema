// Entry point do servidor
import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { prisma } from './lib/prisma';
import { copiarBanco } from './lib/dbSync';
import { agendarBackupDiario } from './lib/backupJob';
import { corrigirDados } from './lib/fixOrphans';

process.on('uncaughtException', (err) => {
  console.error('❌ uncaughtException:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ unhandledRejection:', reason);
});

const PORT = Number(process.env.PORT) || 3001;

async function start() {
  if (process.env.RUN_FIX_ORPHANS === '1') {
    if (!process.env.DATABASE_URL) {
      console.error('❌ RUN_FIX_ORPHANS=1 mas falta DATABASE_URL no .env');
      process.exit(1);
    }
    try {
      await corrigirDados(process.env.DATABASE_URL);
      process.exit(0);
    } catch (err) {
      console.error('❌ Erro no FIX_ORPHANS:', err);
      process.exit(1);
    }
  }

  if (process.env.RUN_DB_COPY === '1') {
    if (!process.env.BACKUP_DIRECT_URL || !process.env.DATABASE_URL) {
      console.error('❌ RUN_DB_COPY=1 mas falta BACKUP_DIRECT_URL ou DATABASE_URL no .env');
      process.exit(1);
    }
    console.log('MIGRACAO: copiando dados do backup para o banco principal');
    try {
      const result = await copiarBanco(process.env.BACKUP_DIRECT_URL, process.env.DATABASE_URL);
      console.log('✅ MIGRACAO concluída:', result);
    } catch (err) {
      console.error('❌ Erro na migração:', err);
      process.exit(1); // Encerra o processo para não subir silenciosamente
    }
  }

  if (process.env.BACKUP_ENABLED === 'true' && process.env.BACKUP_DIRECT_URL) {
    if (process.env.DATABASE_URL) {
      agendarBackupDiario(process.env.DATABASE_URL, process.env.BACKUP_DIRECT_URL);
    }
  }

  app.listen(PORT, () => {
    console.log(`🏪 Servidor da barbearia rodando na porta ${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/health`);

    // Prisma keep-alive
    setInterval(async () => {
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch (err) {
        console.error('❌ Erro no keep-alive do Prisma:', err);
      }
    }, 60000);
  });
}

start();
