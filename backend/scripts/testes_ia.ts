import assert from 'node:assert/strict';
import { configuracaoIa, estadoInatividade, statusIa } from '../src/services/ia/politica';
import { CotasIaIndisponiveis } from '../src/services/ia/cotas';
import { responderTextoOpenAI } from '../src/services/ia/openaiTexto';

async function main() {
  assert.equal(configuracaoIa({}).creditos.BASICO, null);
  assert.equal(configuracaoIa({ IA_CREDITOS_BASICO: '-1' }).creditos.BASICO, null);
  assert.equal(configuracaoIa({ IA_CREDITOS_PRO: 'Infinity' }).creditos.PRO, null);
  assert.equal(configuracaoIa({ IA_CREDITOS_PRO: '1.5' }).creditos.PRO, null);
  assert.equal(statusIa('BASICO', {}).mensagensMensais, 100);
  assert.equal(statusIa('PRO', {}).mensagensMensais, 200);
  assert.equal(statusIa('PRO', {}).vozSegundosMensais, 1800);
  assert.equal(statusIa('BASICO', {}).vozNoPlano, false);
  assert.equal(statusIa(null, {}).mensagensMensais, null);
  assert.equal(statusIa('PRO', { IA_ENABLED: 'true', OPENAI_API_KEY: 'fixture', OPENAI_TEXT_MODEL: 'fixture' }).textoDisponivel, false);
  const reservas = await Promise.allSettled(Array.from({ length: 50 }, () => new CotasIaIndisponiveis().reservar()));
  assert.ok(reservas.every(r => r.status === 'rejected'));
  assert.equal(estadoInatividade(44, false), 'ativa');
  assert.equal(estadoInatividade(45, false), 'avisar');
  assert.equal(estadoInatividade(60, false), 'encerrar');
  assert.equal(estadoInatividade(120, true), 'ativa');
  let chamadas = 0;
  const transporte: typeof fetch = async (url, init) => {
    chamadas++;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, false);
    assert.equal(body.model, 'modelo-teste');
    assert.equal(body.tools, undefined);
    assert.equal(body.max_output_tokens, 512);
    return new Response(JSON.stringify({ id: 'resposta-teste', status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Olá' }] }], usage: { input_tokens: 20, output_tokens: 5 } }));
  };
  const resposta = await responderTextoOpenAI('Olá', { chave: 'fixture', modelo: 'modelo-teste' }, new AbortController().signal, transporte);
  assert.equal(resposta.texto, 'Olá');
  assert.equal(chamadas, 1);
  await assert.rejects(() => responderTextoOpenAI('Olá', { chave: '', modelo: '' }, new AbortController().signal, transporte));
  assert.equal(chamadas, 1);
  await assert.rejects(() => responderTextoOpenAI('Olá', { chave: 'fixture', modelo: 'modelo-teste' }, new AbortController().signal, async () => new Response('segredo-do-provedor', { status: 500 })), /Não foi possível/);

  // HTTP local com Prisma simulado. Não abre conexão com banco nem com OpenAI.
  process.env.JWT_SECRET = 'fixture-admin-local-nao-producao';
  process.env.JWT_SECRET_CLIENTE = 'fixture-cliente-local-nao-producao';
  process.env.JWT_SECRET_BARBEIRO = 'fixture-barbeiro-local-nao-producao';
  const { prisma } = await import('../src/lib/prisma');
  prisma.barbearia.findUnique = (async () => ({ ativo: true })) as any;
  prisma.usuario.findFirst = (async ({ where }: any) => where.id === 'admin-a' && where.barbeariaId === 'tenant-a' ? { id: 'admin-a' } : null) as any;
  prisma.barbeiro.findFirst = (async ({ where }: any) => where.id === 'barbeiro-a' && where.usuarioId === 'usuario-barbeiro' && where.barbeariaId === 'tenant-a' && where.ativo ? { usuarioId: 'usuario-barbeiro' } : null) as any;
  prisma.clienteBarbearia.findFirst = (async ({ where }: any) =>
    where.barbeariaId === 'tenant-a' && where.clienteId === 'cliente-a' && where.cliente.usuarioId === 'usuario-a' ? { clienteId: 'cliente-a' } : null) as any;
  prisma.assinaturaSaas.findUnique = (async () => ({ plano: 'BASICO', status: 'ATIVA', cicloFim: new Date('2099-01-01T00:00:00Z'), fimAcessoEm: null })) as any;
  const express = (await import('express')).default;
  const jwt = (await import('jsonwebtoken')).default;
  const rotas = (await import('../src/routes/ia.routes')).default;
  const app = express();
  app.use(express.json());
  app.use('/ia', rotas);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  try {
    const port = (server.address() as import('node:net').AddressInfo).port;
    const base = `http://127.0.0.1:${port}/ia`;
    const token = jwt.sign({ clienteId: 'cliente-a', usuarioId: 'usuario-a' }, process.env.JWT_SECRET_CLIENTE);
    const headers = { Authorization: `Bearer ${token}` };
    assert.equal((await fetch(`${base}/cliente/tenant-a/status`)).status, 401);
    assert.equal((await fetch(`${base}/admin/status`, { headers })).status, 401);
    assert.equal((await fetch(`${base}/cliente/tenant-b/status`, { headers })).status, 403);
    const ok = await fetch(`${base}/cliente/tenant-a/status`, { headers });
    assert.equal(ok.status, 200);
    const status = await ok.json() as Record<string, unknown>;
    assert.equal(status.mensagensMensais, 100);
    assert.equal(status.creditosRestantes, null);
    assert.equal(status.usuarioId, undefined);
    assert.equal((await fetch(`${base}/cliente/tenant-b/status`, { headers: { ...headers, 'x-barbearia-id': 'tenant-a' } })).status, 403);
    const adminToken = jwt.sign({ id: 'admin-a', papel: 'ADMIN', barbeariaId: 'tenant-a' }, process.env.JWT_SECRET);
    assert.equal((await fetch(`${base}/admin/status`, { headers: { Authorization: `Bearer ${adminToken}` } })).status, 200);
    const adminOutroTenant = jwt.sign({ id: 'admin-a', papel: 'ADMIN', barbeariaId: 'tenant-b' }, process.env.JWT_SECRET);
    assert.equal((await fetch(`${base}/admin/status`, { headers: { Authorization: `Bearer ${adminOutroTenant}` } })).status, 403);
    const barbeiroToken = jwt.sign({ barbeiroId: 'barbeiro-a', usuarioId: 'usuario-barbeiro', barbeariaId: 'tenant-a' }, process.env.JWT_SECRET_BARBEIRO);
    assert.equal((await fetch(`${base}/barbeiro/status`, { headers: { Authorization: `Bearer ${barbeiroToken}` } })).status, 200);
    assert.equal((await fetch(`${base}/admin/status`, { headers: { Authorization: `Bearer ${barbeiroToken}` } })).status, 403);
    for (const rota of ['mensagens', 'voz/sessoes']) {
      const r = await fetch(`${base}/cliente/tenant-a/${rota}`, { method: 'POST', headers });
      assert.equal(r.status, 503);
    }
    const concorrentes = await Promise.all(Array.from({ length: 20 }, () => fetch(`${base}/cliente/tenant-a/mensagens`, { method: 'POST', headers })));
    assert.ok(concorrentes.every(r => r.status === 503));
  } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
  console.log('IA: políticas, bloqueio concorrente, adaptador simulado e isolamento HTTP passaram.');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
