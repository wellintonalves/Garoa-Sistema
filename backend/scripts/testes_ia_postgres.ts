import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { RepositorioCotasPrisma } from '../src/services/ia/repositorioCotasPrisma';
import { calcularFimCiclo } from '../src/domain/assinatura/regrasAssinatura';
import { ContextoIa } from '../src/services/ia/cotas';
import { ConfiguracaoConsumoIa } from '../src/services/ia/configuracaoConsumo';
import { conversarIa } from '../src/services/ia/conversa';
import { supervisionarVoz } from '../src/services/ia/supervisorPersistente';
import { limparResultadosIa } from '../src/services/ia/manutencao';

const url = process.env.IA_TEST_DATABASE_URL;
if (!url) throw new Error('Configure IA_TEST_DATABASE_URL para um banco local descartável.');
const alvo = new URL(url);
if (!['127.0.0.1', 'localhost'].includes(alvo.hostname) || !/^\/valen_ia_test(?:_[a-z0-9]+)?$/.test(alvo.pathname)) throw new Error('Alvo de teste não permitido.');
const db = new PrismaClient({ datasourceUrl: url });
const db2 = new PrismaClient({ datasourceUrl: url });
const config: ConfiguracaoConsumoIa = { mensagens: { BASICO: 100, PRO: 200 }, creditos: { BASICO: 10000, PRO: 10000 },
  custoCreditoMicrousd: 1, tarifaEntradaMicrousd: 2, tarifaSaidaMicrousd: 10,
  modelo: 'modelo-fixture', tarifaVersao: 'fixture-v1', politicaVersao: 'fixture-v1' };
const repo = new RepositorioCotasPrisma(db, config);
const repo2 = new RepositorioCotasPrisma(db2, config);

async function fixture(plano: 'BASICO' | 'PRO' = 'BASICO') {
  const b = await db.barbearia.create({ data: { nome: 'IA teste local', slug: randomUUID() } });
  const u = await db.usuario.create({ data: { barbeariaId: b.id, nome: 'Fixture', email: `${randomUUID()}@example.invalid`, senha: 'sem-login', papel: 'ADMIN' } });
  const inicio = new Date(Date.now() - 1000);
  const s = await db.assinaturaSaas.create({ data: { barbeariaId: b.id, plano, periodicidade: 'MENSAL', precoCicloCentavos: 1, status: 'ATIVA', cicloInicio: inicio, cicloFim: calcularFimCiclo(inicio, 'MENSAL') } });
  return { c: { barbeariaId: b.id, usuarioId: u.id, papel: 'ADMIN' } as ContextoIa, s };
}

async function main() {
  const { c } = await fixture();
  const resultados = await Promise.allSettled(Array.from({ length: 110 }, (_, i) => (i % 2 ? repo : repo2).reservarTexto(c, randomUUID(), 'Olá')));
  if (!resultados.some(r => r.status === 'fulfilled')) console.error(resultados[0]);
  assert.equal(resultados.filter(r => r.status === 'fulfilled').length, 100);
  assert.equal((await repo.saldo(c)).mensagensRestantes, 0);
  const row = await db.iaPeriodo.findFirstOrThrow({ where: { barbeariaId: c.barbeariaId } });
  assert.equal(row.mensagensReservadas, 100);
  await assert.rejects(db.iaPeriodo.update({ where: { id: row.id }, data: { mensagensReservadas: 101 } }), /constraint|check/i);
  await assert.rejects(db.iaPeriodo.create({ data: { ...row, id: randomUUID(), inicio: new Date(row.inicio.getTime() + 1) } }), /sobrepostos/);

  const { c: idempotente } = await fixture();
  const chave = randomUUID();
  const duplicadas = await Promise.all(Array.from({ length: 12 }, (_, i) => (i % 2 ? repo : repo2).reservarTexto(idempotente, chave, 'Pergunta')));
  assert.equal(new Set(duplicadas.map(r => r.id)).size, 1);
  assert.equal((await repo.saldo(idempotente)).mensagensRestantes, 99);
  await assert.rejects(repo.reservarTexto(idempotente, chave, 'Outro corpo'), /outro pedido/);
  const outroAtor = await db.usuario.create({ data: { barbeariaId: idempotente.barbeariaId, papel: 'ADMIN', nome: 'Outro ator', email: `${randomUUID()}@example.invalid`, senha: 'sem-login' } });
  await assert.rejects(repo.reservarTexto({ ...idempotente, usuarioId: outroAtor.id }, chave, 'Pergunta'), /outro pedido/);
  await assert.rejects(repo.saldo({ ...idempotente, barbeariaId: c.barbeariaId }), /Acesso/);
  await assert.rejects(repo.liquidar(c, duplicadas[0].id, { respostaProvedorId: 'fake', tokensEntrada: 0, tokensSaida: 0, mensagens: 1, segundosVoz: 0 }), /Acesso/);
  const envios = await Promise.all([repo.marcarEnvio(idempotente, duplicadas[0].id), repo2.marcarEnvio(idempotente, duplicadas[0].id)]);
  assert.equal(envios.filter(Boolean).length, 1);
  const uso = { respostaProvedorId: randomUUID(), tokensEntrada: 10, tokensSaida: 5, mensagens: 1, segundosVoz: 0 };
  await Promise.all([repo.liquidar(idempotente, duplicadas[0].id, uso), repo2.liquidar(idempotente, duplicadas[0].id, uso)]);
  assert.equal(await db.iaUso.count({ where: { barbeariaId: idempotente.barbeariaId } }), 1);
  await assert.rejects(db.iaUso.updateMany({ where: { barbeariaId: idempotente.barbeariaId }, data: { mensagens: 0 } }), /imutável/);
  await assert.rejects(repo.liquidar(idempotente, duplicadas[0].id, { ...uso, tokensEntrada: 11 }), /divergente/);

  const { c: pro } = await fixture('PRO');
  const voz = await Promise.allSettled([repo.reservarVoz(pro, randomUUID(), 1000, 10), repo2.reservarVoz(pro, randomUUID(), 1000, 10)]);
  assert.equal(voz.filter(r => r.status === 'fulfilled').length, 1);
  await repo.reservarVoz(pro, randomUUID(), 800, 10);
  assert.equal((await repo.saldo(pro)).vozSegundosRestantes, 0);
  await repo.reservarTexto(pro, randomUUID(), 'Texto continua');
  assert.equal((await repo.saldo(pro)).mensagensRestantes, 199);
  const outroTenantMesmaChave = await repo.reservarTexto(pro, chave, 'Pergunta');
  assert.notEqual(outroTenantMesmaChave.id, duplicadas[0].id);
  await assert.rejects(repo.reservarVoz(idempotente, randomUUID(), 60, 1), /exclusiva/);
  const periodoPro = await db.iaPeriodo.findFirstOrThrow({ where: { barbeariaId: pro.barbeariaId } });
  await assert.rejects(db.iaReserva.create({ data: { ...duplicadas[0], id: randomUUID(), periodoId: periodoPro.id, chaveIdempotencia: randomUUID() } }), /Foreign key/i);

  const { c: credito } = await fixture();
  const pouco = new RepositorioCotasPrisma(db, { ...config, creditos: { BASICO: 1, PRO: 1 } });
  await pouco.reservarTexto(credito, randomUUID(), 'Primeiro');
  await assert.rejects(pouco.reservarTexto(credito, randomUUID(), 'Segundo'), /Saldo insuficiente/);

  const { c: recuperacao, s } = await fixture();
  const pendente = await repo.reservarTexto(recuperacao, randomUUID(), 'Timeout');
  await repo.marcarEnvio(recuperacao, pendente.id);
  await repo.marcarIncerta(recuperacao, pendente.id);
  assert.equal((await repo.saldo(recuperacao)).mensagensRestantes, 99);
  const naoEnviada = await repo.reservarTexto(recuperacao, randomUUID(), 'Não enviada');
  await db.iaReserva.update({ where: { id: naoEnviada.id }, data: { enviarAte: new Date(Date.now() - 1000) } });
  assert.equal((await repo.saldo(recuperacao)).mensagensRestantes, 99);
  // Mover fixture para um ciclo pago anterior; o novo ciclo confirmado não herda saldo.
  const anterior = new Date('2026-01-01T03:00:00Z');
  const p = await db.iaPeriodo.findFirstOrThrow({ where: { barbeariaId: recuperacao.barbeariaId } });
  await db.iaPeriodo.update({ where: { id: p.id }, data: { inicio: anterior, fim: calcularFimCiclo(anterior, 'MENSAL') } });
  const atualInicio = new Date(Date.now() - 500);
  await db.assinaturaSaas.update({ where: { id: s.id }, data: { cicloInicio: atualInicio, cicloFim: calcularFimCiclo(atualInicio, 'MENSAL') } });
  await repo.reservarTexto(recuperacao, randomUUID(), 'Novo ciclo');
  assert.equal((await repo.saldo(recuperacao)).mensagensRestantes, 99);
  await repo.liquidar(recuperacao, pendente.id, { ...uso, respostaProvedorId: randomUUID() });
  assert.equal((await repo.saldo(recuperacao)).mensagensRestantes, 99, 'resultado tardio não debita ciclo novo');
  await db.assinaturaSaas.update({ where: { id: s.id }, data: { plano: 'PRO' } });
  assert.equal((await repo.saldo(recuperacao)).bloqueado, true);
  await assert.rejects(repo.reservarTexto(recuperacao, randomUUID(), 'Sem política de upgrade'), /revisão/);

  const { c: conversa } = await fixture();
  const env = { IA_ENABLED: 'true', IA_PERSISTENCIA_ENABLED: 'true', OPENAI_API_KEY: 'fixture-nao-real', OPENAI_TEXT_MODEL: 'modelo-fixture',
    IA_CREDITOS_BASICO: '10000', IA_CREDITOS_PRO: '10000', IA_CUSTO_CREDITO_MICROUSD: '1',
    IA_TARIFA_ENTRADA_MICROUSD_MILHAO: '2', IA_TARIFA_SAIDA_MICROUSD_MILHAO: '10', IA_TARIFA_VERSAO: 'fixture-v1', IA_POLITICA_VERSAO: 'fixture-v1', IA_CONTAGEM_TEXTO: 'RESPOSTA_CONCLUIDA',
    IA_RESULTADO_CHAVE_BASE64: randomBytes(32).toString('base64'), IA_RESULTADO_RETENCAO_HORAS: '1' };
  let chamadas = 0;
  const provedor = async () => { chamadas++; return { texto: 'Resposta fixture', concluida: true, respostaId: randomUUID(), tokensEntrada: 10, tokensSaida: 5 }; };
  const request = randomUUID();
  await Promise.all([conversarIa(db, conversa, request, 'Olá', env, provedor), conversarIa(db2, conversa, request, 'Olá', env, provedor)]);
  assert.equal(chamadas, 1);
  const replay = await conversarIa(db, conversa, request, 'Olá', env, provedor);
  assert.equal(replay.texto, 'Resposta fixture');
  assert.equal(chamadas, 1);
  const incertaKey = randomUUID();
  const falha = async (): Promise<never> => { chamadas++; throw new Error('timeout simulado'); };
  await conversarIa(db, conversa, incertaKey, 'Timeout', env, falha);
  await conversarIa(db2, conversa, incertaKey, 'Timeout', env, falha);
  assert.equal(chamadas, 2, 'timeout não dispara nova chamada paga');
  const { c: supervisor } = await fixture('PRO');
  const sessao = await repo.reservarVoz(supervisor, randomUUID(), 60, 10);
  await repo.marcarEnvio(supervisor, sessao.id);
  await repo.registrarInicioVoz(supervisor, sessao.id, randomUUID());
  await repo.registrarAtividadeVoz(supervisor, sessao.id, true);
  let fechamentos = 0;
  const transporteVoz = { encerrar: async () => {
    fechamentos++;
    await new Promise(r => setTimeout(r, 50));
    return { respostaProvedorId: `sessao-${sessao.id}`, tokensEntrada: 0, tokensSaida: 0, segundosVoz: 1, custoVozMicrousd: 1n };
  } };
  assert.equal(await supervisionarVoz(repo, supervisor, sessao.id, transporteVoz), 'continuar');
  await db.iaSessaoVoz.update({ where: { barbeariaId_reservaId: { barbeariaId: supervisor.barbeariaId, reservaId: sessao.id } }, data: { encerrarAte: new Date(Date.now() - 1) } });
  await Promise.all([supervisionarVoz(repo, supervisor, sessao.id, transporteVoz), supervisionarVoz(repo2, supervisor, sessao.id, transporteVoz)]);
  assert.equal(fechamentos, 1, 'lease impede dois fechamentos simultâneos');
  assert.equal((await repo.saldo(supervisor)).vozSegundosRestantes, 1799);
  const semConfirmacao = await repo.reservarVoz(supervisor, randomUUID(), 60, 10);
  await repo.marcarEnvio(supervisor, semConfirmacao.id);
  await repo.registrarInicioVoz(supervisor, semConfirmacao.id, randomUUID());
  assert.equal(await supervisionarVoz(repo, supervisor, semConfirmacao.id, { encerrar: async () => { throw new Error('offline fixture'); } }, true), 'incerta');
  assert.equal((await repo.saldo(supervisor)).vozSegundosRestantes, 1739, 'falha no fechamento preserva segundos reservados');
  // Expiração do conteúdo não remove ledger nem permite outra geração.
  await db.iaReserva.updateMany({ where: { barbeariaId: conversa.barbeariaId, estado: 'CONCLUIDA' }, data: { resultadoExpiraEm: new Date(Date.now() - 1) } });
  await limparResultadosIa(db);
  assert.equal(await db.iaReserva.count({ where: { barbeariaId: conversa.barbeariaId, respostaCifrada: { not: null } } }), 0);
  assert.equal(await db.iaUso.count({ where: { barbeariaId: conversa.barbeariaId } }), 1);
  // Mesma extensão Prisma/AsyncLocalStorage usada pelas rotas reais.
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
  const { prisma } = await import('../src/lib/prisma');
  const { tenantStorage } = await import('../src/lib/als');
  try {
    await tenantStorage.run({ barbeariaId: conversa.barbeariaId }, async () => {
      const real = new RepositorioCotasPrisma(prisma, config);
      await real.reservarTexto(conversa, randomUUID(), 'Extensão tenant');
      assert.equal((await real.saldo(conversa)).mensagensRestantes, 97);
    });
  } finally { await prisma.$disconnect(); }
  console.log('PostgreSQL local: dois pools concorrentes, quotas 100/200/1800, idempotência, ledger, FK tenant, renovação, reconciliação e conversa simulada passaram.');
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { await db.$disconnect(); await db2.$disconnect(); });
