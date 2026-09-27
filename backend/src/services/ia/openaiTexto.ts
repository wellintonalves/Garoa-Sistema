/** Adaptador chamado pelo orquestrador somente após a reserva persistente.
 * Sem ferramentas, SQL, histórico de outros usuários ou operações de escrita.
 */
export async function responderTextoOpenAI(
  mensagem: string,
  config: { chave: string; modelo: string },
  signal: AbortSignal,
  transporte: typeof fetch = fetch,
): Promise<{ texto: string; concluida: boolean; respostaId: string; tokensEntrada: number; tokensSaida: number }> {
  if (!config.chave.trim() || !config.modelo.trim()) throw new Error('OpenAI não configurada.');
  if (!mensagem.trim() || mensagem.length > 4000) throw new Error('Mensagem inválida.');
  const resposta = await transporte('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.chave}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
    body: JSON.stringify({
      model: config.modelo, store: false, max_output_tokens: 512, service_tier: 'default',
      instructions: 'Você é a assistente do Valen Barber. Responda em português. Nesta fase não tem acesso a dados, agenda ou ferramentas. Não afirme ter consultado dados ou realizado ações.',
      input: [{ role: 'user', content: mensagem }],
    }),
  });
  // Não propagar corpo ou cabeçalhos do provedor (podem conter dados privados).
  if (!resposta.ok) throw new Error('Não foi possível obter uma resposta da IA.');
  const dados = await resposta.json() as {
    id?: string; status?: string;
    output?: { type: string; content?: { type: string; text?: string }[] }[];
    usage?: { input_tokens: number; output_tokens: number };
  };
  const texto = (dados.output ?? []).filter(item => item.type === 'message')
    .flatMap(item => item.content ?? []).filter(item => item.type === 'output_text')
    .map(item => item.text ?? '').join('\n');
  if (!['completed', 'incomplete'].includes(dados.status || '') || !dados.id ||
      !Number.isSafeInteger(dados.usage?.input_tokens) || !Number.isSafeInteger(dados.usage?.output_tokens) ||
      dados.usage!.input_tokens < 0 || dados.usage!.output_tokens < 0) {
    throw new Error('Resposta da IA incompleta. A utilização precisa ser reconciliada.');
  }
  return { texto, concluida: dados.status === 'completed' && Boolean(texto), respostaId: dados.id, tokensEntrada: dados.usage!.input_tokens, tokensSaida: dados.usage!.output_tokens };
}
