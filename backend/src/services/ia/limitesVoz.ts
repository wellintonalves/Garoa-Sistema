/** Teste local limitado; preços oficiais consultados em 27/09/2026.
 * https://developers.openai.com/api/docs/pricing
 * https://developers.openai.com/api/docs/guides/voice-latency-cost?voice-api=realtime
 * Não usa desconto de cache. Nunca aceitar estes limites do navegador.
 */
export const VOZ_LOCAL = Object.freeze({
  modelo: 'gpt-realtime-mini-2025-12-15', voz: 'marin', segundos: 90,
  saidaTokens: 256, contextoTokens: 1500,
  instrucoesBytes: 14000, reservaMicrousd: 90000,
});

// Instruções + ferramentas: um token por byte UTF-8, mais 2.000 de framing.
// Todo o contexto pós-instruções é orçado como áudio (a tarifa mais cara).
// Toda saída também é orçada como áudio. O provedor aplica os dois limites.
// Reserva conservadora para a próxima resposta, somada ao uso já confirmado.
export const ENVELOPE_VOZ_MICROUSD = (
  Math.ceil((VOZ_LOCAL.instrucoesBytes + 2000) * 0.6)
  + VOZ_LOCAL.contextoTokens * 10 + VOZ_LOCAL.saidaTokens * 20
);

export function custoRespostaVoz(usage: unknown): number {
  const u = usage as { input_tokens?: number; output_tokens?: number;
    input_token_details?: { text_tokens?: number; audio_tokens?: number; image_tokens?: number };
    output_token_details?: { text_tokens?: number; audio_tokens?: number } };
  const i = u?.input_token_details, o = u?.output_token_details;
  const numeros = [u?.input_tokens, u?.output_tokens, i?.text_tokens, i?.audio_tokens, o?.text_tokens, o?.audio_tokens];
  if (!numeros.every(n => Number.isSafeInteger(n) && n! >= 0) || (i?.image_tokens ?? 0) !== 0
    || u.input_tokens !== i!.text_tokens! + i!.audio_tokens!
    || u.output_tokens !== o!.text_tokens! + o!.audio_tokens!) throw new Error('Uso de voz não confirmado.');
  return Math.ceil(i!.text_tokens! * 0.6 + i!.audio_tokens! * 10 + o!.text_tokens! * 2.4 + o!.audio_tokens! * 20);
}
