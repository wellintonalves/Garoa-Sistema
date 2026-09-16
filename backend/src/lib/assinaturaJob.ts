import cron from 'node-cron';
import { AssinaturaOperacionalService } from '../services/assinaturaOperacional.service';
import { WebhookAsaasService } from '../services/webhookAsaas.service';
import { provedorAssinatura } from '../integrations/assinaturas/provedorAssinatura';
import { AssinaturaService } from '../services/assinatura.service';
import { triarRetencaoEncerramentos } from '../services/retencaoOperacional.service';

let executando = false;

export async function executarProcessosAssinatura() {
  if (executando) return { ignorado: true, motivo: 'EXECUCAO_EM_ANDAMENTO' };
  executando = true;
  try {
    // Ordem importa: primeiro reconciliar eventos, depois cancelamentos, por fim mudanças.
    const eventos = await WebhookAsaasService.reprocessarPendentes();
    const cancelamentos = await AssinaturaService.reprocessarCancelamentosPendentes(provedorAssinatura);
    const mudancas = await AssinaturaOperacionalService.processarMudancasAgendadas();
    const tolerancias = await AssinaturaOperacionalService.processarToleranciasVencidas(provedorAssinatura);
    const retencao = await triarRetencaoEncerramentos();
    return { ignorado: false, eventos, cancelamentos, mudancas, tolerancias, retencao };
  } finally {
    executando = false;
  }
}

export function agendarProcessosAssinatura(): void {
  if (process.env.NODE_ENV === 'production' && provedorAssinatura.ambiente !== 'PRODUCTION') {
    console.warn('Processos de assinatura exigem provedor de produção validado.');
    return;
  }
  if (process.env.ASSINATURA_JOBS_ENABLED !== 'true') return;
  if (!provedorAssinatura.configurado) return;
  cron.schedule('*/5 * * * *', () => {
    void executarProcessosAssinatura().catch((error) => {
      console.error('Falha nos processos locais de assinatura:', error instanceof Error ? error.message : 'erro desconhecido');
    });
  });
  console.log(`Processos locais de assinatura agendados com provedor ${provedorAssinatura.ambiente}.`);
}
