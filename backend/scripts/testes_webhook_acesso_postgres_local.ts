import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

// Nunca usa URL implícita do .env nem qualquer banco remoto.
const url = process.env.WEBHOOK_TEST_DATABASE_URL;
if (!url) throw new Error('Informe WEBHOOK_TEST_DATABASE_URL para banco descartável local.');
const alvo = new URL(url);
if (!['127.0.0.1', 'localhost'].includes(alvo.hostname) || !alvo.pathname.startsWith('/valen_webhook_test')) throw new Error('Banco não permitido para regressão.');
process.env.DATABASE_URL = url;
process.env.DIRECT_URL = url;
process.env.NODE_ENV = 'test';
process.env.ASSINATURA_PROVEDOR = 'fake';
process.env.ASSINATURA_FAKE_LOCAL_ENABLED = 'true';
const db = new PrismaClient({ datasourceUrl: url });
const prefixo = randomUUID();

async function main() {
  const { WebhookAsaasService: webhook } = await import('../src/services/webhookAsaas.service');
  const { prisma } = await import('../src/lib/prisma');
  const { AvisoPagamentoService } = await import('../src/services/avisoPagamento.service');
  const { resumirTransicaoLegado } = await import('../src/services/transicaoLegado.service');
  const { podeEscreverNaAssinatura, podeLerNaAssinatura, calcularFimCiclo } = await import('../src/domain/assinatura/regrasAssinatura');
  const d = (s: string) => new Date(s);
  const inicio = d('2026-09-15T15:00:00Z');
  const fimTeste = d('2026-09-22T15:00:00Z');
  const barbearia = await db.barbearia.create({ data: { nome: 'Teste webhook sintético', slug: prefixo, legadoAssinatura: false } });
  const admin = await db.usuario.create({ data: { nome: 'Admin teste', email: `${prefixo}@example.invalid`, senha: 'hash-ficticio-sem-login', papel: 'ADMIN', barbeariaId: barbearia.id } });
  const assinatura = await db.assinaturaSaas.create({ data: { barbeariaId: barbearia.id, plano: 'BASICO', periodicidade: 'MENSAL', precoCicloCentavos: 3999, status: 'PRE_CADASTRO', aceiteEm: inicio, proximaCobrancaEm: fimTeste, checkoutExternoId: '__CRIACAO_PENDENTE__' } });
  async function evento(tipo: string, recurso: 'checkout' | 'subscription' | 'payment', id: string, quando: string, extra: Record<string, unknown> = {}) {
    const e = await webhook.registrar({ id: `${prefixo}-${randomUUID()}`, event: tipo, dateCreated: quando, [recurso]: { id, externalReference: assinatura.id, ...extra } });
    return e.eventoId!;
  }
  const criado = await evento('CHECKOUT_CREATED', 'checkout', `co-${prefixo}`, '2026-09-15T15:01:00Z');
  await webhook.processar(criado, inicio);
  assert.equal((await db.assinaturaSaas.findUniqueOrThrow({ where: { id: assinatura.id } })).status, 'PRE_CADASTRO');
  assert.equal((await db.assinaturaSaas.findUniqueOrThrow({ where: { id: assinatura.id } })).checkoutExternoId, `co-${prefixo}`);
  await webhook.processar(await evento('CHECKOUT_PAID', 'checkout', `co-${prefixo}`, '2026-09-16T15:00:00Z'), inicio);
  await webhook.processar(await evento('SUBSCRIPTION_CREATED', 'subscription', `sub-${prefixo}`, '2026-09-17T15:00:00Z'), inicio);
  let atual = await db.assinaturaSaas.findUniqueOrThrow({ where: { id: assinatura.id } });
  assert.equal(atual.status, 'TESTE');
  assert.equal(atual.testeInicio?.toISOString(), inicio.toISOString());
  assert.equal(atual.testeFim?.toISOString(), fimTeste.toISOString());
  assert.equal(atual.proximaCobrancaEm?.toISOString(), fimTeste.toISOString());
  await webhook.processar(await evento('PAYMENT_CONFIRMED', 'payment', `pay1-${prefixo}`, '2026-09-22T16:00:00Z', { dueDate: '2026-09-22' }), fimTeste);
  atual = await db.assinaturaSaas.findUniqueOrThrow({ where: { id: assinatura.id } });
  const fimPago = atual.cicloFim!.toISOString();
  await webhook.processar(await evento('CHECKOUT_PAID', 'checkout', `co-${prefixo}`, '2026-09-25T15:00:00Z'), fimTeste);
  await webhook.processar(await evento('PAYMENT_RECEIVED', 'payment', `pay1-${prefixo}`, '2026-09-26T15:00:00Z', { dueDate: '2026-09-22' }), fimTeste);
  await webhook.processar(await evento('PAYMENT_OVERDUE', 'payment', `pay1-${prefixo}`, '2026-09-27T15:00:00Z', { dueDate: '2026-09-22' }), fimTeste);
  atual = await db.assinaturaSaas.findUniqueOrThrow({ where: { id: assinatura.id } });
  assert.equal(atual.status, 'ATIVA');
  assert.equal(atual.cicloFim!.toISOString(), fimPago);
  const concorrentes = await Promise.all([
    evento('PAYMENT_CONFIRMED', 'payment', `pay2-${prefixo}`, '2026-10-22T16:00:00Z', { dueDate: '2026-10-22' }),
    evento('PAYMENT_OVERDUE', 'payment', `pay2-${prefixo}`, '2026-10-22T16:00:00Z', { dueDate: '2026-10-22' }),
  ]);
  await Promise.all(concorrentes.map(id => webhook.processar(id, d('2026-10-22T17:00:00Z'))));
  atual = await db.assinaturaSaas.findUniqueOrThrow({ where: { id: assinatura.id } });
  assert.equal(atual.status, 'ATIVA');
  assert.equal(atual.cicloInicio!.toISOString(), '2026-10-22T15:00:00.000Z');
  await webhook.processar(await evento('PAYMENT_CONFIRMED', 'payment', `old-${prefixo}`, '2026-10-30T15:00:00Z', { dueDate: '2026-09-01' }), d('2026-10-30T15:00:00Z'));
  assert.equal((await db.assinaturaSaas.findUniqueOrThrow({ where: { id: assinatura.id } })).cicloInicio!.toISOString(), atual.cicloInicio!.toISOString());
  await db.assinaturaSaas.update({ where: { id: assinatura.id }, data: { status: 'CONSULTA_EXPORTACAO', renovacaoAutomatica: false, fimAcessoEm: atual.cicloFim } });
  await webhook.processar(await evento('PAYMENT_RECEIVED', 'payment', `pay2-${prefixo}`, '2026-12-01T15:00:00Z', { dueDate: '2026-10-22' }), d('2026-12-01T15:00:00Z'));
  assert.equal((await db.assinaturaSaas.findUniqueOrThrow({ where: { id: assinatura.id } })).status, 'CONSULTA_EXPORTACAO');
  await assert.rejects(webhook.processar(await evento('PAYMENT_RECEIVED', 'payment', `late-${prefixo}`, '2026-12-01T16:00:00Z', { dueDate: '2026-11-22' }), d('2026-12-01T16:00:00Z')), /reconciliação/);
  assert.equal((await db.assinaturaSaas.findUniqueOrThrow({ where: { id: assinatura.id } })).status, 'CONSULTA_EXPORTACAO');
  await db.assinaturaSaas.update({ where: { id: assinatura.id }, data: { status: 'ATIVA', renovacaoAutomatica: true, fimAcessoEm: null } });

  const preso = await evento('CHECKOUT_CREATED', 'checkout', `co-${prefixo}`, '2026-11-01T15:00:00Z');
  await db.eventoWebhookAsaas.update({ where: { id: preso }, data: { status: 'PROCESSANDO', updatedAt: inicio } });
  assert.equal((await webhook.processar(preso, d('2026-11-02T15:00:00Z'))).processado, true);
  const ocupado = await evento('CHECKOUT_CREATED', 'checkout', `co-${prefixo}`, '2026-11-03T15:00:00Z');
  const agora = d('2026-11-03T15:00:00Z');
  await db.eventoWebhookAsaas.update({ where: { id: ocupado }, data: { status: 'PROCESSANDO', updatedAt: agora } });
  assert.equal((await webhook.processar(ocupado, agora)).processado, false);

  await db.assinaturaSaas.update({ where: { id: assinatura.id }, data: { status: 'PAGAMENTO_PENDENTE', avisoPagamentoEm: null, toleranciaAte: null } });
  const usuario = { id: admin.id, nome: admin.nome, email: admin.email, papel: 'ADMIN' as const, barbeariaId: barbearia.id };
  await Promise.all([AvisoPagamentoService.registrar(usuario, agora), AvisoPagamentoService.registrar(usuario, d('2026-11-04T15:00:00Z'))]);
  atual = await db.assinaturaSaas.findUniqueOrThrow({ where: { id: assinatura.id } });
  assert.equal(atual.toleranciaAte!.getTime() - atual.avisoPagamentoEm!.getTime(), 7 * 86400000);
  const gravado = atual.avisoPagamentoEm!.toISOString();
  await AvisoPagamentoService.registrar(usuario, d('2026-11-06T15:00:00Z'));
  assert.equal((await db.assinaturaSaas.findUniqueOrThrow({ where: { id: assinatura.id } })).avisoPagamentoEm!.toISOString(), gravado);
  await assert.rejects(AvisoPagamentoService.registrar({ ...usuario, barbeariaId: 'outra-unidade' }, agora));
  assert.equal(resumirTransicaoLegado({ legadoAssinatura: true, prazoMigracaoAte: inicio }, atual, true, agora).status, 'MIGRADA');
  assert.equal(podeEscreverNaAssinatura({ status: 'PRE_CADASTRO', agora }), false);
  assert.equal(podeEscreverNaAssinatura({ status: 'TESTE', testeFim: agora, agora }), false);
  assert.equal(podeEscreverNaAssinatura({ status: 'ATIVA', cicloFim: agora, agora }), false);
  assert.equal(podeEscreverNaAssinatura({ status: 'PAGAMENTO_PENDENTE', toleranciaAte: agora, agora }), false);
  assert.equal(podeEscreverNaAssinatura({ status: 'PAGAMENTO_PENDENTE', agora }), true);
  assert.equal(podeLerNaAssinatura({ status: 'ATIVA', cicloFim: agora, agora: new Date(agora.getTime() + 30 * 86400000) }), false);
  assert.equal(calcularFimCiclo(d('2026-02-01T01:30:00Z'), 'MENSAL').toISOString(), '2026-03-01T01:30:00.000Z');
  const { AssinaturaOperacionalService } = await import('../src/services/assinaturaOperacional.service');
  const { ProvedorAssinaturaFakeLocal } = await import('../src/integrations/assinaturas/provedorAssinatura');
  const fake = new ProvedorAssinaturaFakeLocal('test');
  for (const caso of [
    { origem: 'MENSAL', destino: 'ANUAL', plano: 'BASICO', planoDestino: 'BASICO', tipo: 'PERIODICIDADE', valor: 399.90, fim: '2027-10-01T15:00:00.000Z' },
    { origem: 'ANUAL', destino: 'MENSAL', plano: 'BASICO', planoDestino: 'BASICO', tipo: 'PERIODICIDADE', valor: 39.99, fim: '2026-11-01T15:00:00.000Z' },
    { origem: 'MENSAL', destino: 'MENSAL', plano: 'PRO', planoDestino: 'BASICO', tipo: 'DOWNGRADE', valor: 39.99, fim: '2026-11-01T15:00:00.000Z' },
  ] as const) {
    const unidade = await db.barbearia.create({ data: { nome: 'Mudança sintética', slug: randomUUID(), legadoAssinatura: false } });
    const gestor = await db.usuario.create({ data: { nome: 'Admin sintético', email: `${randomUUID()}@example.invalid`, senha: 'hash-ficticio', papel: 'ADMIN', barbeariaId: unidade.id } });
    const contrato = await db.assinaturaSaas.create({ data: {
      barbeariaId: unidade.id, plano: caso.plano, periodicidade: caso.origem, precoCicloCentavos: caso.plano === 'PRO' ? 6999 : caso.origem === 'ANUAL' ? 39990 : 3999,
      status: 'ATIVA', assinaturaExternaId: randomUUID(), cicloInicio: d(caso.origem === 'ANUAL' ? '2025-10-01T15:00:00Z' : '2026-09-01T15:00:00Z'),
      cicloFim: d('2026-10-01T15:00:00Z'), proximaCobrancaEm: d('2026-10-01T15:00:00Z'),
    } });
    const mudanca = await db.mudancaAssinatura.create({ data: {
      assinaturaId: contrato.id, solicitadoPorId: gestor.id, tipo: caso.tipo, status: 'AGENDADA', planoOrigem: caso.plano, planoDestino: caso.planoDestino,
      periodicidadeOrigem: caso.origem, periodicidadeDestino: caso.destino, valorAdicionalCentavos: 0,
      efetivarEm: d('2026-10-01T15:00:00Z'), chaveIdempotencia: randomUUID(), ofertaVersao: 'teste', aceiteEm: inicio,
    } });
    const momento = d('2026-10-01T15:01:00Z');
    if (caso.destino === 'ANUAL') {
      const errado = await webhook.registrar({ id: randomUUID(), event: 'PAYMENT_CONFIRMED', dateCreated: momento.toISOString(), payment: { id: randomUUID(), externalReference: contrato.id, dueDate: '2026-10-01', value: 39.99 } });
      await assert.rejects(webhook.processar(errado.eventoId!, momento), /Valor/);
      assert.equal((await db.assinaturaSaas.findUniqueOrThrow({ where: { id: contrato.id } })).periodicidade, 'MENSAL');
      assert.equal((await db.mudancaAssinatura.findUniqueOrThrow({ where: { id: mudanca.id } })).status, 'AGENDADA');
    }
    const pago = await webhook.registrar({ id: randomUUID(), event: 'PAYMENT_CONFIRMED', dateCreated: momento.toISOString(), payment: { id: randomUUID(), externalReference: contrato.id, dueDate: '2026-10-01', value: caso.valor } });
    if (caso.tipo === 'DOWNGRADE') {
      const equipe = await Promise.all(Array.from({ length: 9 }, (_, i) => db.barbeiro.create({ data: {
        barbearia: { connect: { id: unidade.id } }, especialidades: [],
        usuario: { create: { nome: `Barbeiro fictício ${i}`, email: `${randomUUID()}@example.invalid`, senha: 'hash-ficticio', papel: 'BARBEIRO', barbeariaId: unidade.id } },
      } })));
      await assert.rejects(webhook.processar(pago.eventoId!, momento), /cadastros excedentes/);
      assert.equal((await db.assinaturaSaas.findUniqueOrThrow({ where: { id: contrato.id } })).plano, 'PRO');
      await db.barbeiro.update({ where: { id: equipe[0].id }, data: { ativo: false } });
      let entrou!: () => void;
      let liberar!: () => void;
      const entrouNoProvedor = new Promise<void>(resolve => { entrou = resolve; });
      const liberarProvedor = new Promise<void>(resolve => { liberar = resolve; });
      const atualizarOriginal = fake.atualizarRecorrencia.bind(fake);
      (fake as any).atualizarRecorrencia = async (entrada: { assinaturaExternaId: string }) => {
        if (entrada.assinaturaExternaId === contrato.assinaturaExternaId) { entrou(); await liberarProvedor; }
        return atualizarOriginal();
      };
      const job = AssinaturaOperacionalService.processarMudancasAgendadas(momento, fake);
      await Promise.race([entrouNoProvedor, new Promise((_, reject) => setTimeout(() => reject(new Error('Job não chegou ao provedor de teste')), 5000))]);
      let webhookTerminou = false;
      const pagamento = webhook.processar(pago.eventoId!, momento).then(valor => { webhookTerminou = true; return valor; });
      await new Promise(resolve => setTimeout(resolve, 100));
      assert.equal(webhookTerminou, false, 'job deve manter lock enquanto sincroniza provedor');
      liberar();
      await Promise.all([pagamento, job]);
      fake.atualizarRecorrencia = atualizarOriginal;
    } else {
      await webhook.processar(pago.eventoId!, momento);
      await AssinaturaOperacionalService.processarMudancasAgendadas(momento, fake);
    }
    const resultado = await db.assinaturaSaas.findUniqueOrThrow({ where: { id: contrato.id } });
    assert.equal(resultado.periodicidade, caso.destino);
    assert.equal(resultado.plano, caso.planoDestino);
    assert.equal(resultado.cicloFim?.toISOString(), caso.fim);
    assert.equal(resultado.proximaCobrancaEm?.toISOString(), caso.fim, 'job após webhook não pode devolver vencimento antigo');
    assert.equal((await db.mudancaAssinatura.findUniqueOrThrow({ where: { id: mudanca.id } })).status, 'EFETIVADA');
  }
  console.log('PASS PostgreSQL: trial imutável, ordem/concorrência, lease, aviso idempotente, legado convertido, gates e calendário São Paulo');
  await prisma.$disconnect();
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
