import assert from 'node:assert/strict';
import crypto from 'node:crypto';

async function main() {
  const url = process.env.TEST_DATABASE_URL || 'postgresql://preview@127.0.0.1:55432/valen_preview';
  const parsed = new URL(url);
  assert.ok(['127.0.0.1', 'localhost'].includes(parsed.hostname) && parsed.port === '55432' && /^\/valen_(preview|test)/.test(parsed.pathname), 'Somente banco local descartável');
  process.env.DATABASE_URL = url; process.env.DIRECT_URL = url;
  process.env.DOTENV_CONFIG_PATH = 'no-test-env-file';
  const { prisma } = await import('../src/lib/prisma');
  const { AssinaturaService } = await import('../src/services/assinatura.service');
  const suffix = crypto.randomUUID();
  const shop = await prisma.barbearia.create({ data: { nome: 'Teste recuperação cancelamento', slug: `cancel-test-${suffix}` } });
  const admin = await prisma.usuario.create({ data: { nome: 'Admin fictício', email: `${suffix}@example.invalid`, senha: 'not-a-login-hash', papel: 'ADMIN', barbeariaId: shop.id } });
  const request = await prisma.solicitacaoCancelamentoAssinatura.create({ data: { barbeariaId: shop.id, solicitadoPorId: admin.id, solicitadoPorEmail: admin.email, chaveIdempotencia: suffix } });
  let calls = 0; let active = true; let refuseFirst = true;
  const provider: any = { nome: 'FAKE', configurado: true, ambiente: 'LOCAL_FAKE',
    consultarAssinatura: async () => ({ estado: active ? 'ATIVA' : 'INATIVA' }),
    cancelarRenovacao: async () => { calls++; if (refuseFirst) { refuseFirst = false; return { estado: 'PENDENTE', mensagem: 'Timeout simulado' }; } active = false; return { estado: 'CONFIRMADO', mensagem: 'Confirmado' }; },
  };
  const now = new Date();
  await AssinaturaService.processarSolicitacaoCancelamento(request.id, provider, now);
  assert.equal(calls, 0, 'aguarda criação da assinatura externa');
  const end = new Date(now.getTime() + 20 * 86400000);
  const subscription = await prisma.assinaturaSaas.create({ data: { barbeariaId: shop.id, plano: 'BASICO', periodicidade: 'MENSAL', precoCicloCentavos: 3999, status: 'ATIVA', cicloFim: end, assinaturaExternaId: `sub-fake-${suffix}` } });
  await Promise.all([1,2].map(() => AssinaturaService.processarSolicitacaoCancelamento(request.id, provider, now)));
  assert.equal(calls, 1, 'reserva impede cancelamentos concorrentes');
  assert.equal((await prisma.solicitacaoCancelamentoAssinatura.findUniqueOrThrow({ where: { id: request.id } })).status, 'PROCESSAMENTO_PENDENTE');
  await AssinaturaService.processarSolicitacaoCancelamento(request.id, provider, new Date(now.getTime() + 60000));
  assert.equal(calls, 1, 'respeita intervalo após falha');
  await AssinaturaService.reprocessarCancelamentosPendentes(provider, new Date(now.getTime() + 6 * 60000));
  assert.equal(calls, 2, 'job retoma solicitação após falha');
  const result = await prisma.assinaturaSaas.findUniqueOrThrow({ where: { id: subscription.id } });
  assert.equal(result.renovacaoAutomatica, false); assert.equal(result.status, 'ATIVA'); assert.equal(result.fimAcessoEm?.getTime(), end.getTime());
  await AssinaturaService.processarSolicitacaoCancelamento(request.id, provider, new Date(now.getTime() + 20 * 60000));
  assert.equal(calls, 2, 'pedido confirmado não repete chamada');
  console.log('PASS PostgreSQL: vínculo tardio, concorrência, falha transitória, recuperação por job e acesso pago preservado.');
  await prisma.$disconnect();
}
main().catch(error => { console.error(error); process.exitCode = 1; });
