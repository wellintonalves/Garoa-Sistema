import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { EventEmitter, once } from 'node:events';
import WebSocket from 'ws';
import { PrismaClient } from '@prisma/client';
import { instalarVozProducao, criarTicketVozLocal, statusVoz } from '../src/services/ia/voz';
import { configuracaoVoz } from '../src/services/ia/configuracaoVoz';
import { VOZ_LOCAL } from '../src/services/ia/limitesVoz';
import { calcularFimCiclo } from '../src/domain/assinatura/regrasAssinatura';
import { RepositorioCotasPrisma } from '../src/services/ia/repositorioCotasPrisma';
import { obterConfiguracaoConsumo } from '../src/services/ia/configuracaoConsumo';
const url = process.env.IA_TEST_DATABASE_URL;
if (url !== 'postgresql://ia_test@127.0.0.1:55439/valen_ia_test') throw new Error('Somente PostgreSQL local de teste.');
globalThis.fetch = async () => { throw new Error('Rede externa proibida no teste.'); };
Object.assign(process.env, { DATABASE_URL: url, IA_VOZ_ENABLED: 'true', IA_ENABLED: 'true', IA_PERSISTENCIA_ENABLED: 'true',
  OPENAI_API_KEY: 'fixture-sem-rede', OPENAI_TEXT_MODEL: 'fixture', OPENAI_VOICE_MODEL: VOZ_LOCAL.modelo,
  IA_CREDITOS_BASICO: '200000', IA_CREDITOS_PRO: '200000', IA_CUSTO_CREDITO_MICROUSD: '10',
  IA_TARIFA_ENTRADA_MICROUSD_MILHAO: '600000', IA_TARIFA_SAIDA_MICROUSD_MILHAO: '2400000',
  IA_TARIFA_VERSAO: 'fixture', IA_POLITICA_VERSAO: 'fixture', IA_CONTAGEM_TEXTO: 'RESPOSTA_CONCLUIDA',
  IA_RESULTADO_CHAVE_BASE64: randomBytes(32).toString('base64'), IA_RESULTADO_RETENCAO_HORAS: '1',
  IA_VOZ_TICKET_SECRET: randomBytes(32).toString('hex'), IA_VOZ_PUBLIC_URL: 'wss://api.example.invalid/ia/voz/conexao',
  IA_VOZ_ORIGENS: 'https://app.example.invalid', IA_VOZ_CREDITOS: 'TODOS_CUSTOS' });
const db = new PrismaClient({ datasourceUrl: url });
const server = createServer(); let conexoes = 0; let fechar = () => {};
async function main() {
  assert.equal(configuracaoVoz({ IA_VOZ_ENABLED: 'false' }), null);
  assert.throws(() => configuracaoVoz({ ...process.env, IA_VOZ_PUBLIC_URL: 'ws://api.example.invalid/ia/voz/conexao' }));
  assert.throws(() => configuracaoVoz({ ...process.env, IA_VOZ_ORIGENS: '*' }));
  assert.throws(() => configuracaoVoz({ ...process.env, IA_VOZ_TICKET_SECRET: 'curta' }));
  assert.throws(() => configuracaoVoz({ ...process.env, OPENAI_VOICE_MODEL: 'outro-modelo' }));
  const b = await db.barbearia.create({ data: { nome: 'Fixture produção voz', slug: randomUUID() } });
  const u = await db.usuario.create({ data: { barbeariaId: b.id, nome: 'Fixture', email: randomUUID() + '@example.invalid', senha: 'sem-login', papel: 'ADMIN' } });
  const c = { barbeariaId: b.id, usuarioId: u.id, papel: 'ADMIN' as const };
  const inicio = new Date(Date.now() - 1000);
  const assinatura = await db.assinaturaSaas.create({ data: { barbeariaId: b.id, plano: 'PRO', periodicidade: 'MENSAL', precoCicloCentavos: 1,
    status: 'ATIVA', cicloInicio: inicio, cicloFim: calcularFimCiclo(inicio, 'MENSAL') } });
  fechar = instalarVozProducao(server, db, () => {
    conexoes++;
    const fake = Object.assign(new EventEmitter(), { readyState: WebSocket.OPEN as number,
      send: (s: string) => { const e = JSON.parse(s); if (e.type === 'session.update') {
        assert.equal(e.session.audio.output.voice, 'marin');
        setImmediate(() => fake.emit('message', Buffer.from(JSON.stringify({ type: 'session.updated', session: e.session }))));
      } },
      close: () => { fake.readyState = WebSocket.CLOSED; setImmediate(() => fake.emit('close', 1000)); },
      terminate: () => { fake.readyState = WebSocket.CLOSED; fake.emit('close', 1006); } });
    setImmediate(() => { fake.emit('message', Buffer.from(JSON.stringify({ type: 'session.created', session: { id: randomUUID() } }))); fake.emit('open'); });
    return fake as unknown as WebSocket;
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const destino = `ws://127.0.0.1:${(server.address() as { port: number }).port}/ia/voz/conexao`;
  async function usar(ticket: string, aoOuvir?: () => Promise<void>) {
    const ws = new WebSocket(destino, { origin: 'https://app.example.invalid' });
    let ouviu = false;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => { ws.terminate(); reject(new Error('Timeout')); }, 8000);
      ws.on('open', () => ws.send(JSON.stringify({ ticket })));
      ws.on('error', reject);
      ws.on('message', data => {
        const e = JSON.parse(data.toString());
        if (e.estado === 'ouvindo' && !ouviu) { ouviu = true; void (async () => {
          if (aoOuvir) await aoOuvir(); ws.send('{"tipo":"encerrar"}');
        })().catch(reject); }
      });
      ws.on('close', () => { clearTimeout(timeout); resolve(); });
    });
    return ouviu;
  }
  const ticket = await criarTicketVozLocal(c, undefined);
  assert.equal(ticket.url, process.env.IA_VOZ_PUBLIC_URL);
  assert.equal(await usar(ticket.ticket, async () => {
    assert.equal((await statusVoz(c)).vozOcupada, true);
    await assert.rejects(criarTicketVozLocal(c, undefined));
  }), true);
  assert.equal(await usar(ticket.ticket), false); assert.equal(conexoes, 1);
  assert.equal(await usar(ticket.ticket + 'x'), false); assert.equal(conexoes, 1);
  const errado = new WebSocket(destino, { origin: 'https://intruso.example.invalid' });
  await once(errado, 'error'); assert.equal(conexoes, 1);
  assert.equal(await usar((await criarTicketVozLocal(c, undefined)).ticket), true);
  assert.equal(conexoes, 2);
  const r = await db.iaReserva.findFirstOrThrow({ where: { barbeariaId: b.id }, orderBy: { criadaEm: 'desc' } });
  assert.equal(r.creditosMaximos, 9000); // Unidade de crédito diferente de 1 microUSD.
  const repo = new RepositorioCotasPrisma(db, obterConfiguracaoConsumo());
  const disputas = await Promise.allSettled([repo.reservarVoz(c, randomUUID(), 90, 9000, true), repo.reservarVoz(c, randomUUID(), 90, 9000, true)]);
  assert.equal(disputas.filter(x => x.status === 'fulfilled').length, 1);
  for (const x of disputas) if (x.status === 'fulfilled') await repo.liberarVozNaoConectada(c, x.value.id).catch(async () => {
    await repo.marcarEnvio(c, x.value.id); await repo.liberarVozNaoConectada(c, x.value.id);
  });
  await assert.rejects(criarTicketVozLocal({ ...c, barbeariaId: randomUUID() }, undefined));
  await db.assinaturaSaas.update({ where: { id: assinatura.id }, data: { plano: 'BASICO' } });
  assert.equal((await statusVoz(c)).vozDisponivel, false);
  await assert.rejects(criarTicketVozLocal(c, undefined));
  console.log('Voz produção: WSS/origem, Marin, ticket assinado, replay, tenant, Pro, concorrência distribuída, conversão de crédito e reabertura. Provedor simulado.');
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { fechar(); server.close(); await db.$disconnect(); });
