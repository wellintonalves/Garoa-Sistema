import cron from 'node-cron';
import { copiarBanco } from './dbSync';

export function agendarBackupDiario(sourceUrl: string, targetUrl: string) {
  console.log('🕒 Agendando backup diário para 04:15 (America/Sao_Paulo)');
  
  // 04:15 todos os dias
  cron.schedule('15 4 * * *', async () => {
    console.log('BACKUP DIARIO: iniciado');
    try {
      const result = await copiarBanco(sourceUrl, targetUrl);
      console.log('✅ BACKUP DIARIO: concluido', result);
    } catch (error) {
      console.error('❌ BACKUP DIARIO: falhou', error);
      // Nunca deixe derrubar o servidor
    }
  }, {
    timezone: "America/Sao_Paulo"
  });
}
