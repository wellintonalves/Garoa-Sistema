import { registrarErroSeguro } from './lib/logSeguro';
// Entry point do servidor
import app from './app';
import { createServer } from 'node:http';
import { instalarVozProducao } from './services/ia/voz';
import { prisma } from './lib/prisma';
import { copiarBanco } from './lib/dbSync';
import { agendarBackupDiario } from './lib/backupJob';
import { corrigirDados } from './lib/fixOrphans';
import { agendarProcessosAssinatura } from './lib/assinaturaJob';
import { agendarLimpezaResultadosIa } from './services/ia/manutencao';

process.on('uncaughtException', (err) => {
  registrarErroSeguro('server.falha', err);
});

process.on('unhandledRejection', (reason) => {
  registrarErroSeguro('server.falha', reason);
});

const PORT = Number(process.env.PORT) || 3001;

async function start() {
  if (process.env.RUN_FIX_ORPHANS === '1') {
    if (!process.env.DATABASE_URL) {
      registrarErroSeguro('server.falha', undefined);
      process.exit(1);
    }
    try {
      await corrigirDados(process.env.DATABASE_URL);
      console.log('✅ FIX ORPHANS concluído com sucesso');
    } catch (err) {
      registrarErroSeguro('server.falha', err);
      process.exit(1);
    }
  }

  if (process.env.RUN_DB_COPY === '1') {
    if (!process.env.BACKUP_DIRECT_URL || !process.env.DATABASE_URL) {
      registrarErroSeguro('server.falha', undefined);
      process.exit(1);
    }
    console.log('MIGRACAO: copiando dados do backup para o banco principal');
    try {
      const result = await copiarBanco(process.env.BACKUP_DIRECT_URL, process.env.DATABASE_URL, { modo: 'RESTAURACAO' });
      console.log('MIGRACAO concluída');
    } catch (err) {
      registrarErroSeguro('server.falha', err);
      process.exit(1); // Encerra o processo para não subir silenciosamente
    }
  }

  if (process.env.BACKUP_ENABLED === 'true' && process.env.BACKUP_DIRECT_URL) {
    if (process.env.DATABASE_URL) {
      agendarBackupDiario(process.env.DATABASE_URL, process.env.BACKUP_DIRECT_URL);
    }
  }

  agendarProcessosAssinatura();
  agendarLimpezaResultadosIa(prisma);

  const servidor = createServer(app);
  const encerrarVoz = instalarVozProducao(servidor, prisma);
  process.once('SIGTERM', () => {
    encerrarVoz(); servidor.close();
    setTimeout(() => process.exit(0), 5000).unref();
  });
  servidor.listen(PORT, () => {
    console.log(`🏪 Servidor da barbearia rodando na porta ${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/health`);

    // Prisma keep-alive
    setInterval(async () => {
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch (err) {
        registrarErroSeguro('server.falha', err);
      }
    }, 60000);
  });
}

start();
