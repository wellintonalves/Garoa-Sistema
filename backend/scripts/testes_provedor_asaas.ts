import assert from 'node:assert/strict';
import {
  ProvedorAsaasSandbox,
  ProvedorAssinaturaFakeLocal,
  criarProvedorAssinatura,
  validarTokenWebhookAsaas,
} from '../src/integrations/assinaturas/provedorAssinatura';

type Chamada = { url: string; init?: RequestInit };
const chamadas: Chamada[] = [];
const respostas = [
  new Response(JSON.stringify({
    id: 'chk_sandbox_1',
    link: 'https://sandbox.asaas.com/checkoutSession/show/chk_sandbox_1',
    status: 'ACTIVE',
  }), { status: 200 }),
  new Response('', { status: 200 }),
  new Response(JSON.stringify({
    id: 'sub_sandbox_1',
    status: 'ACTIVE',
    nextDueDate: '2026-10-22',
  }), { status: 200 }),
];

const fetchFake = (async (url: string | URL | Request, init?: RequestInit) => {
  chamadas.push({ url: String(url), init });
  const resposta = respostas.shift();
  if (!resposta) throw new Error('Resposta fake não configurada.');
  return resposta;
}) as typeof fetch;

async function main() {
  const token = 'token_webhook_teste_com_mais_de_32_caracteres';
  const provedor = new ProvedorAsaasSandbox({
    apiKey: '$aact_hmlg_chave_ficticia_nao_real',
    webhookToken: token,
    successUrl: 'http://127.0.0.1:5173/configuracoes?checkout=sucesso',
    cancelUrl: 'http://127.0.0.1:5173/configuracoes?checkout=cancelado',
    expiredUrl: 'http://127.0.0.1:5173/configuracoes?checkout=expirado',
    userAgent: 'ValenBarber-Testes/1.0',
    checkoutExpiracaoMinutos: 30,
  }, fetchFake);

  const checkout = await provedor.criarCheckoutAssinatura({
    referenciaExterna: 'assinatura-local-1',
    nomeItem: 'Plano Básico com um nome maior que trinta caracteres',
    descricao: 'Teste de contrato',
    valorCentavos: 3999,
    periodicidade: 'MENSAL',
    primeiroVencimento: new Date('2026-09-22T12:00:00-03:00'),
    formasPagamento: ['CREDIT_CARD'],
  });
  assert.equal(checkout.estado, 'CRIADO');
  assert.equal(checkout.checkoutId, 'chk_sandbox_1');
  assert.match(checkout.checkoutUrl || '', /^https:\/\/sandbox\.asaas\.com\//);
  const corpoCheckout = JSON.parse(String(chamadas[0].init?.body));
  assert.deepEqual(corpoCheckout.billingTypes, ['CREDIT_CARD']);
  assert.deepEqual(corpoCheckout.chargeTypes, ['RECURRENT']);
  assert.equal(corpoCheckout.items[0].name.length, 30);
  const antesPix = chamadas.length;
  const pixRecorrente = await provedor.criarCheckoutAssinatura({ formasPagamento: ['PIX'] } as any);
  assert.equal(pixRecorrente.estado, 'FALHA');
  assert.equal(pixRecorrente.criacaoConfirmadamenteRecusada, true);
  assert.equal(chamadas.length, antesPix, 'Pix recorrente rejeitado antes de chamar provedor');
  assert.equal(corpoCheckout.subscription.cycle, 'MONTHLY');
  assert.equal(corpoCheckout.subscription.nextDueDate, '2026-09-22');
  assert.equal((chamadas[0].init?.headers as Record<string, string>).access_token, '$aact_hmlg_chave_ficticia_nao_real');
  assert.match(chamadas[0].url, /^https:\/\/api-sandbox\.asaas\.com\/v3\/checkouts$/);

  const cancelamento = await provedor.cancelarRenovacao({
    solicitacaoId: 'sol-1',
    barbeariaId: 'barb-1',
    assinaturaExternaId: 'sub_sandbox_1',
    chaveIdempotencia: 'cancelamento-1',
  });
  assert.equal(cancelamento.estado, 'CONFIRMADO');
  assert.equal(chamadas[1].init?.method, 'DELETE');

  const consulta = await provedor.consultarAssinatura('sub_sandbox_1');
  assert.equal(consulta.estado, 'ATIVA');
  assert.equal(consulta.proximaCobrancaEm?.toISOString(), '2026-10-22T15:00:00.000Z');
  respostas.push(new Response(JSON.stringify({ id: 'pix-avulso', link: 'https://sandbox.asaas.com/checkoutSession/show/pix-avulso' }), { status: 200 }));
  const pixAvulso = await provedor.criarCheckoutAvulso({ referenciaExterna: 'mudanca:1', nomeItem: 'Upgrade proporcional', descricao: 'Diferença do período', valorCentavos: 1500, formasPagamento: ['PIX'] });
  assert.equal(pixAvulso.estado, 'CRIADO');
  const corpoAvulso = JSON.parse(String(chamadas.at(-1)?.init?.body));
  assert.deepEqual(corpoAvulso.billingTypes, ['PIX']);
  assert.deepEqual(corpoAvulso.chargeTypes, ['DETACHED']);

  const configuracaoInvalida = criarProvedorAssinatura({
    NODE_ENV: 'production',
    ASSINATURA_ASAAS_SANDBOX_ENABLED: 'true',
    ASAAS_ENV: 'production',
    ASAAS_API_KEY: '$aact_prod_nunca_aceitar',
  });
  assert.equal(configuracaoInvalida.configurado, false);
  assert.equal(configuracaoInvalida.ambiente, 'DESATIVADO');

  const fakeLocal = criarProvedorAssinatura({
    NODE_ENV: 'test',
    ASSINATURA_PROVEDOR: 'fake',
    ASSINATURA_FAKE_LOCAL_ENABLED: 'true',
  });
  assert.equal(fakeLocal.ambiente, 'LOCAL_FAKE');
  const fakeBloqueado = criarProvedorAssinatura({
    NODE_ENV: 'production',
    ASSINATURA_PROVEDOR: 'fake',
    ASSINATURA_FAKE_LOCAL_ENABLED: 'true',
  });
  assert.equal(fakeBloqueado.configurado, false);
  assert.throws(() => new ProvedorAssinaturaFakeLocal('production'), /proibido em produção/);

  assert.equal(validarTokenWebhookAsaas(token, { ASAAS_WEBHOOK_TOKEN: token }), true);
  assert.equal(validarTokenWebhookAsaas(`${token}x`, { ASAAS_WEBHOOK_TOKEN: token }), false);
  assert.equal(validarTokenWebhookAsaas(undefined, { ASAAS_WEBHOOK_TOKEN: token }), false);

  console.log('✅ Contrato Asaas: Sandbox restrito, checkout hospedado, autenticação, cancelamento, consulta, webhook e fake local protegidos. Nenhuma rede real usada.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
