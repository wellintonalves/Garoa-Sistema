import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = 'segredo-teste-apenas-local-com-mais-de-24';
process.env.JWT_SECRET_CLIENTE = 'segredo-cliente-teste-apenas-local-com-24';
process.env.JWT_SECRET_BARBEIRO = 'segredo-barbeiro-teste-apenas-local-com-24';
process.env.ASSINATURA_PROVEDOR = 'fake';
process.env.ASSINATURA_FAKE_LOCAL_ENABLED = 'true';
const eventos = new Map<string, any>();
const assinaturas = [{ id: 'sa', barbeariaId: 'a', checkoutExternoId: 'chk-a', status: 'PRE_CADASTRO' }, { id: 'sb', barbeariaId: 'b', checkoutExternoId: 'chk-b', status: 'PRE_CADASTRO' }];
let processados = 0;
const db = {
  usuario: { findFirst: async ({ where }: any) => where.id === `admin-${where.barbeariaId}` ? { id: where.id } : null },
  barbearia: { findUnique: async ({ where }: any) => ({ id: where.id, ativo: true, legadoAssinatura: where.id === 'a' }) },
  assinaturaSaas: { findUnique: async ({ where }: any) => assinaturas.find(a => a.barbeariaId === where.barbeariaId) },
  mudancaAssinatura: { findFirst: async () => null },
  eventoWebhookAsaas: { findUnique: async ({ where }: any) => eventos.get(where.eventoExternoId) },
};
(globalThis as any).prisma = { $extends: () => db };
async function main() {
  const { WebhookAsaasService } = await import('../src/services/webhookAsaas.service');
  WebhookAsaasService.registrar = async (payload: any) => {
    if (eventos.has(payload.id)) return { duplicado: true, eventoId: payload.id };
    eventos.set(payload.id, { ...payload, status: 'PENDENTE' });
    return { duplicado: false, eventoId: payload.id };
  };
  WebhookAsaasService.processar = (async (id: string) => { eventos.get(id).status = 'PROCESSADO'; processados++; return { processado: true }; }) as any;
  const router = (await import('../src/routes/checkoutLocal.routes')).default;
  const { ProvedorAssinaturaFakeLocal } = await import('../src/integrations/assinaturas/provedorAssinatura');
  assert.throws(() => new ProvedorAssinaturaFakeLocal('production'), /proibido/);
  for (const origin of ['https://127.0.0.1', 'http://example.com', 'http://127.0.0.1.example.com', 'http://127.0.0.1/other', 'http://127.0.0.1?redirect=x', 'http://user@127.0.0.1']) {
    assert.throws(() => new ProvedorAssinaturaFakeLocal('development', origin), /endereço local/);
  }
  const checkout = await new ProvedorAssinaturaFakeLocal('development', 'http://127.0.0.1:5174').criarCheckoutAssinatura({ referenciaExterna: 'a', formasPagamento: ['CREDIT_CARD'] } as any);
  assert.ok(checkout.checkoutUrl?.startsWith('http://127.0.0.1:5174/dev/checkout?'));
  const app = express(); app.use(express.json());
  // Controlled transport override only inside this test, never the application.
  app.use((req, _res, next) => { Object.defineProperty(req.socket, 'remoteAddress', { value: req.headers['x-test-remote'] || '127.0.0.1', configurable: true }); next(); });
  app.use('/dev/checkout-local', router);
  app.use((error: any, _req: any, res: any, _next: any) => res.status(error.statusCode || 500).json({ erro: error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  const port = (server.address() as any).port;
  const token = (unit: string, papel = 'ADMIN', id = `admin-${unit}`) => jwt.sign({ id, papel, barbeariaId: unit }, process.env.JWT_SECRET!);
  const request = (body: any, auth: string | null = token('a'), headers: Record<string, string> = {}) => fetch(`http://127.0.0.1:${port}/dev/checkout-local/confirmar`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...headers }, body: JSON.stringify(body) });
  try {
    assert.equal((await request({ checkout: 'chk-a', resultado: 'aprovado' }, null)).status, 401);
    assert.equal((await request({ checkout: 'chk-a', resultado: 'aprovado' }, token('a', 'BARBEIRO'))).status, 403);
    assert.equal((await request({ checkout: 'chk-a', resultado: 'aprovado' }, token('a', 'ADMIN', 'removed-admin'))).status, 403);
    assert.equal((await request({ checkout: 'chk-b', resultado: 'aprovado' })).status, 404);
    assert.equal((await request({ checkout: 'chk-a', resultado: 'invalid' })).status, 400);
    assert.equal((await request({ checkout: 'chk-a', resultado: 'aprovado' }, token('a'), { 'x-test-remote': '203.0.113.1', 'x-forwarded-for': '127.0.0.1' })).status, 404);
    process.env.NODE_ENV = 'production';
    assert.equal((await request({ checkout: 'chk-a', resultado: 'aprovado' })).status, 404);
    process.env.NODE_ENV = 'development'; process.env.ASSINATURA_FAKE_LOCAL_ENABLED = 'false';
    assert.equal((await request({ checkout: 'chk-a', resultado: 'aprovado' })).status, 404);
    process.env.ASSINATURA_FAKE_LOCAL_ENABLED = 'true'; process.env.ASSINATURA_PROVEDOR = 'asaas';
    assert.equal((await request({ checkout: 'chk-a', resultado: 'aprovado' })).status, 404);
    process.env.ASSINATURA_PROVEDOR = 'fake';
    assert.equal((await request({ checkout: 'chk-a', resultado: 'recusado' })).status, 200);
    assert.equal(eventos.get('demo-chk-a-recusado').event, 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED');
    assert.equal((await request({ checkout: 'chk-a', resultado: 'aprovado' })).status, 200);
    assert.equal(eventos.get('demo-chk-a-pagamento').event, 'PAYMENT_CONFIRMED', 'legado deve confirmar pagamento, sem trial');
    const antes = processados;
    assert.equal((await request({ checkout: 'chk-a', resultado: 'aprovado' })).status, 200);
    assert.equal(processados, antes, 'repetição não reprocessa eventos');
    assert.equal((await request({ checkout: 'chk-a', resultado: 'recusado' })).status, 409);
    assert.equal((await request({ checkout: 'chk-b', resultado: 'aprovado' }, token('b'))).status, 200);
    assert.equal(eventos.has('demo-chk-b-pagamento'), false, 'novo recebe checkout de teste, não confirmação de cobrança');
    console.log('Checkout local: HTTP, autorização, isolamento, loopback, flags, produção, aprovação/recusa e idempotência passaram.');
  } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
