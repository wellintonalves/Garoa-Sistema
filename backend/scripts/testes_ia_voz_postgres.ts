import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { PrismaClient } from '@prisma/client';
import { instalarVozLocal, criarTicketVozLocal } from '../src/services/ia/vozLocal';
import { RepositorioCotasPrisma } from '../src/services/ia/repositorioCotasPrisma';
import { obterConfiguracaoConsumo } from '../src/services/ia/configuracaoConsumo';
import { calcularFimCiclo } from '../src/domain/assinatura/regrasAssinatura';
const url = process.env.IA_TEST_DATABASE_URL;
if (url !== 'postgresql://ia_test@127.0.0.1:55439/valen_ia_test') throw new Error('Use somente banco local descartável.');
Object.assign(process.env, { DATABASE_URL: url, IA_VOZ_LOCAL_ENABLED: 'true', IA_ENABLED: 'true', IA_PERSISTENCIA_ENABLED: 'true', OPENAI_API_KEY: 'fixture-sem-rede', OPENAI_TEXT_MODEL: 'fixture',
  IA_CREDITOS_BASICO: '200000', IA_CREDITOS_PRO: '200000', IA_CUSTO_CREDITO_MICROUSD: '1', IA_TARIFA_ENTRADA_MICROUSD_MILHAO: '600000', IA_TARIFA_SAIDA_MICROUSD_MILHAO: '2400000', IA_TARIFA_VERSAO: 'fixture', IA_POLITICA_VERSAO: 'fixture', IA_CONTAGEM_TEXTO: 'RESPOSTA_CONCLUIDA', IA_RESULTADO_CHAVE_BASE64: randomBytes(32).toString('base64'), IA_RESULTADO_RETENCAO_HORAS: '1' });
const db = new PrismaClient({ datasourceUrl: url });
const server = createServer(); let fake: EventEmitter & { readyState: number; send: (s: string) => void; close: () => void; terminate: () => void };
let saldo = 97000, conexoes = 0;
async function main() {
  const b = await db.barbearia.create({ data: { nome: 'Fixture voz', slug: randomUUID() } });
  const u = await db.usuario.create({ data: { barbeariaId: b.id, nome: 'Fixture voz', email: `${randomUUID()}@example.invalid`, senha: 'sem-login', papel: 'ADMIN' } });
  const c = { barbeariaId: b.id, usuarioId: u.id, papel: 'ADMIN' as const }, inicio = new Date(Date.now() - 1000);
  const assinatura = await db.assinaturaSaas.create({ data: { barbeariaId: b.id, plano: 'BASICO', periodicidade: 'MENSAL', precoCicloCentavos: 1, status: 'ATIVA', cicloInicio: inicio, cicloFim: calcularFimCiclo(inicio, 'MENSAL') } });
  instalarVozLocal(server, { db, usuarioId: u.id, barbeariaId: b.id, saldo: () => saldo,
    reservar: (_id, valor) => { assert.ok(saldo >= valor); saldo -= valor; }, liquidar: (_id, reservado, custo) => { saldo += reservado - custo; } }, () => {
    conexoes++;
    fake = Object.assign(new EventEmitter(), { readyState: 1,
      send: (s: string) => { const e = JSON.parse(s); if (e.type === 'session.update') setImmediate(() => fake.emit('message', Buffer.from(JSON.stringify({ type: 'session.updated', session: e.session })))); },
      close: () => { fake.readyState = 3; setImmediate(() => fake.emit('close', 1000)); }, terminate: () => { fake.readyState = 3; fake.emit('close', 1006); } });
    setImmediate(() => { fake.emit('message', Buffer.from(JSON.stringify({ type: 'session.created', session: { id: randomUUID() } }))); fake.emit('open'); });
    return fake as unknown as WebSocket;
  });
  await new Promise<void>(r => server.listen(55443, '127.0.0.1', r));
  await assert.rejects(criarTicketVozLocal(c, undefined), /Pro/);
  await db.assinaturaSaas.update({ where: { id: assinatura.id }, data: { plano: 'PRO' } });
  await assert.rejects(criarTicketVozLocal({ ...c, usuarioId: randomUUID() }, undefined));
  const ticket = await criarTicketVozLocal(c, undefined);
  const ws = new WebSocket('ws://127.0.0.1:55443/ia/voz/conexao', { origin: 'http://127.0.0.1:5173' });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout no transporte local')), 10000);
    ws.on('open', () => ws.send(JSON.stringify({ ticket: ticket.ticket })));
    ws.on('message', bytes => {
      const e = JSON.parse(bytes.toString());
      if (e.estado === 'ouvindo') ws.send('{"tipo":"encerrar"}');
      if (e.tipo === 'fim') { clearTimeout(timeout); assert.match(e.texto, /Conversa encerrada/); resolve(); }
    }); ws.on('error', reject);
  });
  assert.equal(conexoes, 1); assert.equal(saldo, 97000);
  const period = await db.iaPeriodo.findFirstOrThrow({ where: { barbeariaId: b.id } });
  assert.equal(period.mensagensLimite, 200); assert.equal(period.mensagensConsumidas, 0); assert.equal(period.creditosReservados, 0);
  const sessao = await db.iaSessaoVoz.findFirstOrThrow({ where: { barbeariaId: b.id } }); assert.equal(sessao.estado, 'ENCERRADA');
  const repo = new RepositorioCotasPrisma(db, obterConfiguracaoConsumo());
  const naoConectada = await repo.reservarVoz(c, randomUUID(), 90, 90000);
  await repo.marcarEnvio(c, naoConectada.id); await repo.liberarVozNaoConectada(c, naoConectada.id);
  assert.equal((await repo.saldo(c)).creditosRestantes, 200000);
  const incerta = await repo.reservarVoz(c, randomUUID(), 90, 90000);
  await repo.marcarEnvio(c, incerta.id); await repo.registrarInicioVoz(c, incerta.id, randomUUID());
  await assert.rejects(repo.liberarVozNaoConectada(c, incerta.id)); await repo.marcarIncerta(c, incerta.id);
  assert.equal((await repo.saldo(c)).creditosRestantes, 110000);
  console.log('Voz: autenticação do ticket, plano Básico/Pro, WebSocket local, reserva, liquidação e falha incerta validados em PostgreSQL. Provedor simulado; nenhuma conexão OpenAI.');
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { server.close(); await db.$disconnect(); });
