import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const url = process.env.WEBHOOK_TEST_DATABASE_URL;
if (!url) throw new Error('Informe o banco descartável de teste local.');
const alvo = new URL(url);
if (!['127.0.0.1', 'localhost'].includes(alvo.hostname) || !alvo.pathname.startsWith('/valen_webhook_test')) throw new Error('Banco não permitido.');
process.env.DATABASE_URL = url; process.env.DIRECT_URL = url; process.env.NODE_ENV = 'test';
process.env.ASSINATURA_PROVEDOR = 'fake'; process.env.ASSINATURA_FAKE_LOCAL_ENABLED = 'true';
const db = new PrismaClient({ datasourceUrl: url });

async function main() {
  const { WebhookAsaasService: webhook } = await import('../src/services/webhookAsaas.service');
  const { RegularizacaoAssinaturaService: regularizacao, obterRevisaoFinanceira } = await import('../src/services/regularizacaoAssinatura.service');
  const { provedorAssinatura } = await import('../src/integrations/assinaturas/provedorAssinatura');
  const { prisma } = await import('../src/lib/prisma');
  const unidade = await db.barbearia.create({ data: { nome: 'Teste reversões', slug: randomUUID(), legadoAssinatura: false } });
  const admin = await db.usuario.create({ data: { nome: 'Gestor teste', email: `${randomUUID()}@example.invalid`, senha: 'hash-ficticio', papel: 'ADMIN', barbeariaId: unidade.id } });
  const usuario = { id: admin.id, nome: admin.nome, email: admin.email, papel: 'ADMIN' as const, barbeariaId: unidade.id };
  const sub = randomUUID(), cliente = randomUUID(), pay = randomUUID();
  const assinatura = await db.assinaturaSaas.create({ data: {
    barbeariaId: unidade.id, plano: 'BASICO', periodicidade: 'MENSAL', precoCicloCentavos: 3999, status: 'ATIVA',
    assinaturaExternaId: sub, clienteExternoId: cliente, ultimaCobrancaExternaId: pay,
    cicloInicio: new Date('2026-09-22T15:00:00Z'), cicloFim: new Date('2026-10-22T15:00:00Z'), proximaCobrancaEm: new Date('2026-10-22T15:00:00Z'),
  } });
  const atual = () => db.assinaturaSaas.findUniqueOrThrow({ where: { id: assinatura.id } });
  const momento = new Date('2026-09-24T15:00:00Z');
  const evento = (tipo: string, id = randomUUID(), extras = {}, data = momento) => ({ id, event: tipo, dateCreated: data.toISOString(), payment: { id: pay, subscription: sub, customer: cliente, externalReference: assinatura.id, dueDate: '2026-09-22', value: 39.99, ...extras } });
  async function processar(payload: object) { const e = await webhook.registrar(payload); await webhook.processar(e.eventoId!, momento); return e; }
  let consultas = 0, atualizacoes = 0;
  provedorAssinatura.consultarCobranca = async entrada => { consultas++; assert.equal(entrada.clienteExternoId, cliente); return { estado: 'CONFIRMADO', status: 'CONFIRMED', invoiceUrl: 'https://sandbox.asaas.com/i/fixture', mensagem: 'OK' }; };
  provedorAssinatura.usarCartaoDaCobranca = async entrada => { atualizacoes++; assert.equal(entrada.assinaturaExternaId, sub); return { estado: 'CONFIRMADO', mensagem: 'OK' }; };
  await assert.rejects(regularizacao.obter({ ...usuario, papel: 'BARBEIRO' }), /administrador/);
  await assert.rejects(regularizacao.obter({ ...usuario, barbeariaId: randomUUID() }), /autorizado/);
  assert.equal(consultas, 0, 'outra barbearia não consulta provedor');
  assert.equal((await regularizacao.obter(usuario)).estado, 'PAGA');
  await assert.rejects(regularizacao.usarCartao(usuario, false, '127.0.0.1'), /Confirme/);
  await assert.rejects(regularizacao.usarCartao(usuario, true, 'inválido'), /conexão/);
  await regularizacao.usarCartao(usuario, true, '127.0.0.1');
  assert.equal(atualizacoes, 1);

  const disputa = evento('PAYMENT_CHARGEBACK_REQUESTED');
  const registrados = await Promise.all([webhook.registrar(disputa), webhook.registrar(disputa)]);
  assert.equal(registrados.filter(e => e.duplicado).length, 1);
  await Promise.all(registrados.map(e => webhook.processar(e.eventoId!, momento)));
  assert.equal((await atual()).status, 'ATIVA', 'contestação não é estorno definitivo');
  assert.ok(await obterRevisaoFinanceira(await atual()));
  assert.equal((await regularizacao.obter(usuario)).estado, 'EM_REVISAO');
  await assert.rejects(regularizacao.usarCartao(usuario, true, '127.0.0.1'), /revisão/);
  await processar(evento('PAYMENT_CONFIRMED', randomUUID(), {}, new Date('2026-09-23T15:00:00Z')));
  assert.ok(await obterRevisaoFinanceira(await atual()), 'confirmação antiga não resolve contestação');
  await processar(evento('PAYMENT_RECEIVED', randomUUID(), {}, new Date('2026-09-25T15:00:00Z')));
  assert.equal(await obterRevisaoFinanceira(await atual()), null, 'confirmação posterior conferida no provedor resolve revisão');
  assert.equal((await atual()).cicloFim?.toISOString(), assinatura.cicloFim?.toISOString(), 'resolução não estende ciclo');
  await processar(evento('PAYMENT_CHARGEBACK_DISPUTE'));
  assert.equal(await obterRevisaoFinanceira(await atual()), null, 'contestação antiga entregue depois não reabre revisão resolvida');

  await processar(evento('PAYMENT_PARTIALLY_REFUNDED', randomUUID(), {}, new Date('2026-09-26T15:00:00Z')));
  assert.equal((await atual()).status, 'ATIVA');
  assert.equal((await obterRevisaoFinanceira(await atual()))?.tipo, 'PAYMENT_PARTIALLY_REFUNDED');
  const total = evento('PAYMENT_REFUNDED');
  const estorno = await processar(total);
  const encerrada = await atual();
  assert.equal(encerrada.status, 'CONSULTA_EXPORTACAO');
  assert.equal(encerrada.renovacaoAutomatica, true, 'não declara cancelamento externo sem confirmação');
  await webhook.processar(estorno.eventoId!, new Date('2026-09-26T15:00:00Z'));
  assert.equal((await atual()).fimAcessoEm?.toISOString(), encerrada.fimAcessoEm?.toISOString(), 'duplicata não reinicia prazo');
  await processar(evento('PAYMENT_RECEIVED', randomUUID(), {}, new Date('2026-09-27T15:00:00Z')));
  assert.equal((await atual()).status, 'CONSULTA_EXPORTACAO', 'pagamento estornado não reativa');
  const nova = await webhook.registrar(evento('PAYMENT_CONFIRMED', randomUUID(), { id: randomUUID(), dueDate: '2026-10-22' }, new Date('2026-10-22T15:00:00Z')));
  await webhook.processar(nova.eventoId!, new Date('2026-10-22T15:00:00Z'));
  assert.equal((await atual()).status, 'ATIVA');
  await processar(evento('PAYMENT_REFUNDED'));
  assert.equal((await atual()).status, 'ATIVA', 'estorno antigo não bloqueia novo ciclo pago');
  const errado = await webhook.registrar(evento('PAYMENT_REFUNDED', randomUUID(), { subscription: 'outra-assinatura' }));
  await assert.rejects(webhook.processar(errado.eventoId!, momento), /divergente/);
  assert.equal((await atual()).status, 'ATIVA');
  const upgrade = await db.mudancaAssinatura.create({ data: {
    assinaturaId: assinatura.id, solicitadoPorId: admin.id, tipo: 'UPGRADE', status: 'EFETIVADA', planoOrigem: 'BASICO', planoDestino: 'PRO',
    periodicidadeOrigem: 'MENSAL', periodicidadeDestino: 'MENSAL', valorAdicionalCentavos: 1000, chaveIdempotencia: randomUUID(), ofertaVersao: 'teste', aceiteEm: momento,
  } });
  await processar(evento('PAYMENT_REFUNDED', randomUUID(), { id: randomUUID(), externalReference: `mudanca:${upgrade.id}`, subscription: undefined }));
  assert.ok(await obterRevisaoFinanceira(await atual()), 'estorno de upgrade avulso também aparece para reconciliação');
  assert.equal((await atual()).status, 'ATIVA', 'upgrade estornado não apaga período base já pago');
  console.log('PASS PostgreSQL: isolamento, regularização, aceite do cartão, reversões concorrentes/duplicadas, confirmação fora de ordem, estorno parcial/total e renovação posterior.');
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());
