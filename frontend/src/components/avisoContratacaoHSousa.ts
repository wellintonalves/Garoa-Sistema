import type { TransicaoLegado } from './TransicaoLegadoBanner';

export const H_SOUSA_ATIVA_ID = '757f0caa-33e6-4409-96cb-c8c6fce85358';
const FIM = Date.parse('2026-10-26T00:00:00-03:00');

// Exceção de apresentação autorizada para o pagamento feito por fora.
// Não concede acesso, registra pagamento nem muda a transição no backend.
export function ocultarAvisoContratacaoHSousa(
  barbeariaId: string | null | undefined,
  transicao: TransicaoLegado | null,
  assinatura: { status: string } | null,
  agora: number,
) {
  return barbeariaId === H_SOUSA_ATIVA_ID && assinatura === null
    && transicao?.legada === true && transicao.status === 'PRAZO_MIGRACAO'
    && Date.parse(transicao.prazoAte ?? '') === FIM
    && agora < FIM;
}

export function agendarLimiteAvisoHSousa(agora: number, atualizar: () => void) {
  const limite = agora < FIM ? FIM : null;
  if (limite === null) return () => {};
  // setTimeout só aceita até cerca de 24 dias, menos que o período coberto.
  const timer = setTimeout(atualizar, Math.min(limite - agora, 2_147_483_647));
  return () => clearTimeout(timer);
}
