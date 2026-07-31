import cron from 'node-cron';
import { copiarBanco } from './dbSync';
import { Resend } from 'resend';

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
      
      if (process.env.RESEND_API_KEY) {
        try {
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: 'Valen Barber <onboarding@resend.dev>',
            to: process.env.ADMIN_EMAIL || 'valenbarber@resend.dev',
            subject: '🚨 Falha Crítica no Backup Diário - Valen Barber',
            html: `<p>O backup diário do banco de dados <strong>falhou</strong>.</p><p><strong>Erro:</strong></p><pre>${error instanceof Error ? error.message : String(error)}</pre><p>Verifique os logs no Railway para mais detalhes.</p>`
          });
          console.log('📧 Alerta de falha de backup enviado por e-mail.');
        } catch (emailError) {
          console.error('❌ Falha ao enviar alerta de e-mail sobre o backup', emailError);
        }
      }
    }
  }, {
    timezone: "America/Sao_Paulo"
  });
}
