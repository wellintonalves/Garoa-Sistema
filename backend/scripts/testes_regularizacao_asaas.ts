import assert from 'node:assert/strict';
import { ProvedorAsaasSandbox } from '../src/integrations/assinaturas/provedorAssinatura';

const config = { apiKey: '$aact_hmlg_fixture', webhookToken: 'token-ficticio-sem-valor-real-123456789', successUrl: 'http://localhost/success', cancelUrl: 'http://localhost/cancel', expiredUrl: 'http://localhost/expired', userAgent: 'Teste', checkoutExpiracaoMinutos: 30 };
const entrada = { cobrancaExternaId: 'pay-1', assinaturaExternaId: 'sub-1', clienteExternoId: 'cus-1' };
const pagamento = { id: 'pay-1', subscription: 'sub-1', customer: 'cus-1', status: 'OVERDUE', invoiceUrl: 'https://sandbox.asaas.com/i/fixture' };
function provider(respostas: unknown[]) {
  const chamadas: Array<{ url: string; init: RequestInit }> = [];
  const p = new ProvedorAsaasSandbox(config, (async (url, init) => {
    chamadas.push({ url: String(url), init: init! });
    const corpo = respostas.shift();
    if (corpo instanceof Error) throw corpo;
    if (!corpo) throw new Error('Resposta de teste ausente');
    return new Response(JSON.stringify(corpo), { status: 200 });
  }) as typeof fetch);
  return { p, chamadas };
}
async function main() {
  const ok = provider([pagamento]);
  assert.equal((await ok.p.consultarCobranca(entrada)).invoiceUrl, pagamento.invoiceUrl);
  assert.deepEqual(ok.chamadas.map(c => c.init.method), ['GET']);
  for (const alteracao of [{ id: 'outro' }, { subscription: 'outra' }, { customer: 'outro' }, { deleted: true },
    { invoiceUrl: 'https://sandbox.asaas.com.evil.test/i/1' }, { invoiceUrl: 'https://www.asaas.com/i/1' }, { invoiceUrl: 'https://user:pass@sandbox.asaas.com/i/1' }]) {
    const teste = provider([{ ...pagamento, ...alteracao }]);
    assert.equal((await teste.p.consultarCobranca(entrada)).estado, 'FALHA');
    assert.equal(teste.chamadas.length, 1);
  }
  const estornado = provider([{ ...pagamento, status: 'REFUNDED' }]);
  assert.equal((await estornado.p.consultarCobranca(entrada)).invoiceUrl, undefined);
  const semCartao = provider([pagamento]);
  assert.equal((await semCartao.p.usarCartaoDaCobranca({ ...entrada, remoteIp: '203.0.113.1' })).estado, 'FALHA');
  assert.equal(semCartao.chamadas.length, 1);
  const pago = { ...pagamento, status: 'CONFIRMED', creditCard: { creditCardToken: 'token-ficticio' } };
  const sub = { id: 'sub-1', customer: 'cus-1', status: 'ACTIVE' };
  const cartao = provider([pago, sub, sub]);
  const resultado = await cartao.p.usarCartaoDaCobranca({ ...entrada, remoteIp: '203.0.113.1' });
  assert.equal(resultado.estado, 'CONFIRMADO');
  assert.deepEqual(cartao.chamadas.map(c => c.init.method), ['GET', 'GET', 'PUT']);
  assert.ok(cartao.chamadas[2].url.endsWith('/subscriptions/sub-1/creditCard'));
  assert.deepEqual(JSON.parse(String(cartao.chamadas[2].init.body)), { creditCardToken: 'token-ficticio', remoteIp: '203.0.113.1' });
  assert.ok(!JSON.stringify(resultado).includes('token-ficticio'));
  const outra = provider([pago, { ...sub, customer: 'cus-other' }]);
  assert.equal((await outra.p.usarCartaoDaCobranca({ ...entrada, remoteIp: '203.0.113.1' })).estado, 'FALHA');
  assert.equal(outra.chamadas.length, 2);
  const timeout = provider([pago, sub, new Error('erro com dado sensível')]);
  const incerto = await timeout.p.usarCartaoDaCobranca({ ...entrada, remoteIp: '203.0.113.1' });
  assert.equal(incerto.estado, 'PENDENTE');
  assert.ok(!incerto.mensagem.includes('sensível'));
  assert.equal(timeout.chamadas.length, 3, 'não repete PUT automaticamente');
  console.log('PASS regularização: vínculo, ambiente, somente GET da fatura, cartão sem cobrança, sem vazamento e sem retry de PUT. Rede simulada.');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
