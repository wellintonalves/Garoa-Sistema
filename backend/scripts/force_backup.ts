import dotenv from 'dotenv';
import { copiarBanco } from '../src/lib/dbSync';
dotenv.config();

async function forceBackup() {
  const sourceUrl = process.env.DATABASE_URL;
  const targetUrl = process.env.BACKUP_DIRECT_URL;

  if (!sourceUrl || !targetUrl) {
    console.error('❌ Falta DATABASE_URL ou BACKUP_DIRECT_URL no .env');
    process.exit(1);
  }

  console.log('🚀 Iniciando backup forçado manualmente...');
  
  try {
    const result = await copiarBanco(sourceUrl, targetUrl);
    console.log('✅ BACKUP FORÇADO CONCLUÍDO:', result);
    process.exit(0);
  } catch (error) {
    console.error('❌ BACKUP FORÇADO FALHOU:', error);
    process.exit(1);
  }
}

forceBackup();
