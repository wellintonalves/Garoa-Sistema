export const EVENTOS_REVERSAO = [
  'PAYMENT_REFUNDED', 'PAYMENT_PARTIALLY_REFUNDED', 'PAYMENT_REFUND_IN_PROGRESS',
  'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_CHARGEBACK_DISPUTE', 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
];

export function mensagemRevisaoFinanceira(tipo: string): string {
  if (tipo === 'PAYMENT_REFUNDED') return 'O pagamento foi estornado. Consulte o suporte para conferir o acesso e as próximas renovações.';
  if (tipo === 'PAYMENT_PARTIALLY_REFUNDED') return 'Foi registrado um estorno parcial. O período de acesso foi preservado; consulte o suporte para conferir os valores.';
  if (tipo === 'PAYMENT_REFUND_IN_PROGRESS') return 'Há um estorno em processamento. Aguarde a confirmação do Asaas antes de realizar outro pagamento.';
  return 'Há uma contestação deste pagamento. Consulte o suporte para acompanhar a análise; não é necessário pagar novamente esta cobrança.';
}
