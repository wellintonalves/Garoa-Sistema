import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export class EmailService {
  static async enviarCodigoVerificacao(email: string, nome: string, codigo: string): Promise<void> {
    console.log('[EmailService] Tentando enviar para:', email);
    console.log('[EmailService] API Key presente:', !!process.env.RESEND_API_KEY);
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error(`Email inválido: ${email}`);
    }

    await resend.emails.send({
      from: 'Garoa Sistema <noreply@valenbarber.com.br>',
      to: email,
      subject: 'Seu código de verificação — Garoa Sistema',
      html: `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0A0A0A; color: #F5F5F5; border-radius: 12px; overflow: hidden;">
          <div style="background: #F59E0B; padding: 32px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #0A0A0A; letter-spacing: 0.02em;">
              GAROA SISTEMA
            </h1>
          </div>
          <div style="padding: 40px 32px;">
            <p style="margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #F5F5F5;">
              Olá, ${nome}!
            </p>
            <p style="margin: 0 0 32px; font-size: 14px; color: #737373; line-height: 1.6;">
              Use o código abaixo para confirmar seu email. Ele expira em <strong style="color: #F5F5F5;">10 minutos</strong>.
            </p>
            <div style="background: #141414; border: 1px solid #2A2A2A; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 32px;">
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 36px; font-weight: 700; color: #F59E0B; letter-spacing: 0.2em;">
                ${codigo}
              </span>
            </div>
            <p style="margin: 0; font-size: 12px; color: #525252; line-height: 1.6;">
              Se você não solicitou esse código, ignore este email. Nenhuma ação é necessária.
            </p>
          </div>
          <div style="padding: 20px 32px; border-top: 1px solid #1F1F1F; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #404040;">
              Garoa Sistema — Feito para quem aceita apenas o melhor.
            </p>
          </div>
        </div>
      `,
    });
  }
}
