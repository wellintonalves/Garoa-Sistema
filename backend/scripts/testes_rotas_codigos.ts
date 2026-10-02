import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';

process.env.JWT_SECRET = 'teste-rotas-codigos-admin-segredo-local';
process.env.JWT_SECRET_CLIENTE = 'teste-rotas-codigos-cliente-segredo-local';
process.env.JWT_SECRET_BARBEIRO = 'teste-rotas-codigos-barbeiro-segredo-local';
delete process.env.RESEND_API_KEY;
const budgets = new Map<string, { tentativas: number; expiraEm: Date }>();
(globalThis as any).prisma = { $extends: () => ({
  $queryRaw: async (_sql: unknown, key: string, windowMs: number) => {
    const previous = budgets.get(key);
    const value = previous && previous.expiraEm.getTime() > Date.now() ? { ...previous, tentativas: previous.tentativas + 1 } : { tentativas: 1, expiraEm: new Date(Date.now() + windowMs) };
    budgets.set(key, value); return [value];
  },
  $executeRaw: async () => 0,
}) };

async function main() {
  const { VerificacaoService } = await import('../src/services/verificacao.service');
  const chamadas: { nome: string; args: unknown[] }[] = [];
  VerificacaoService.enviarCodigo = async (...args) => { chamadas.push({ nome: 'enviar', args }); };
  VerificacaoService.enviarCodigoRecuperacao = async (...args) => { chamadas.push({ nome: 'recuperar', args }); };
  VerificacaoService.verificarCodigo = async (...args) => { chamadas.push({ nome: 'confirmar', args }); return true; };
  VerificacaoService.redefinirSenha = async (...args) => { chamadas.push({ nome: 'redefinir', args }); };
  const { default: verificacao } = await import('../src/routes/verificacao.routes');
  const { default: recuperacao } = await import('../src/routes/recuperacao.routes');
  const app = express(); app.use(express.json()); app.use('/verificacao', verificacao); app.use('/recuperacao', recuperacao);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  async function post(path: string, body: unknown) {
    const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }
  try {
    assert.equal((await post('/verificacao/enviar', { usuarioId: 'sintetico', email: 'outro@example.test', nome: 'Outro' })).status, 200);
    assert.deepEqual(chamadas[0], { nome: 'enviar', args: ['sintetico'] }, 'destino recebido não chega ao serviço');
    assert.equal((await post('/verificacao/reenviar', { usuarioId: 'sintetico' })).status, 200, 'UI sem campos legados permanece válida');
    const contexto = { email: 'conta@example.test', papel: 'BARBEIRO', barbeariaSlug: 'unidade-local' };
    const conhecido = await post('/recuperacao/solicitar', contexto);
    const ausente = await post('/recuperacao/solicitar', { email: 'ausente@example.test' });
    assert.deepEqual(conhecido, ausente, 'resposta pública não distingue identidade');
    assert.deepEqual(chamadas[2], { nome: 'recuperar', args: [contexto.email, { papel: contexto.papel, barbeariaSlug: contexto.barbeariaSlug }] });
    assert.equal((await post('/verificacao/enviar', { usuarioId: ['sintetico'] })).status, 400);
    for (let i = 0; i < 5; i++) assert.equal((await post(i % 2 ? '/verificacao/enviar' : '/verificacao/reenviar', { usuarioId: 'sintetico' })).status, 200);
    for (let i = 0; i < 3; i++) await post('/verificacao/enviar', { usuarioId: 'sintetico' });
    assert.equal((await post('/verificacao/reenviar', { usuarioId: 'sintetico' })).status, 429, 'enviar e reenviar compartilham orçamento de conta');

    assert.equal((await post('/recuperacao/redefinir', { ...contexto, codigo: '123456', novaSenha: 'nova-senha-local' })).status, 200);
    assert.deepEqual(chamadas.at(-1), { nome: 'redefinir', args: [contexto.email, '123456', 'nova-senha-local', { papel: contexto.papel, barbeariaSlug: contexto.barbeariaSlug }] });
    assert.equal((await post('/recuperacao/redefinir', { ...contexto, codigo: '123456', novaSenha: 'x'.repeat(129) })).status, 400);
    assert.equal((await post('/verificacao/confirmar', { usuarioId: 'sintetico', codigo: { equals: '123456' } })).status, 400);
    for (let i = 0; i < 17; i++) assert.equal((await post('/verificacao/confirmar', { usuarioId: 'sintetico', codigo: '123456' })).status, 200);
    for (let i = 0; i < 3; i++) await post('/verificacao/confirmar', { usuarioId: 'sintetico', codigo: '123456' });
    assert.equal((await post('/verificacao/confirmar', { usuarioId: 'sintetico', codigo: '123456' })).status, 429, 'tentativas da mesma conta são limitadas');
    console.log('PASS: contratos HTTP, destino ignorado, contexto preservado, mensagens genéricas, validação e limites compartilhados (loopback, serviços simulados).');
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
