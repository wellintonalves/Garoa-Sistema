import assert from 'node:assert/strict';
import { categoriaErroSeguro, registrarErroSeguro } from '../src/lib/logSeguro';
import { EmailService, escaparHtmlEmail } from '../src/services/email.service';
import type { AddressInfo } from 'node:net';
async function main() {
const segredo = 'segredo-sintetico@example.test/token=123456';
const registros: string[] = [];
const original = console.error;
console.error = (...args) => { registros.push(args.join(' ')); };
try {
  const erro = Object.assign(new Error(segredo), { code: 'P2002', meta: { senha: segredo } });
  registrarErroSeguro('teste_falha', erro, 'ERR-TEST');
  registrarErroSeguro('teste_falha', { name: segredo, message: segredo, code: segredo });
  assert.equal(categoriaErroSeguro(erro), 'P2002');
  assert.ok(registros.every(linha => !linha.includes(segredo)));
  assert.equal(JSON.parse(registros[0]).referencia, 'ERR-TEST');
  assert.equal(escaparHtmlEmail('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  delete process.env.RESEND_API_KEY;
  await assert.rejects(EmailService.enviarCodigoVerificacao('teste@example.test', '<script>x</script>', '123456'), { status: 503 });
  await assert.rejects(EmailService.enviarCodigoRecuperacaoSenha('teste@example.test', 'Teste', '123456'), { status: 503 });
} finally { console.error = original; }
process.env.JWT_SECRET = 'logs-admin-segredo-sintetico-local';
process.env.JWT_SECRET_CLIENTE = 'logs-cliente-segredo-sintetico-local';
process.env.JWT_SECRET_BARBEIRO = 'logs-barbeiro-segredo-sintetico-local';
const { default: app } = await import('../src/app');
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const logOriginal = console.log;
const linhas: string[] = [];
console.log = (...args) => { linhas.push(args.join(' ')); };
try {
  const resposta = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/health?token=${segredo}`, { headers: { Authorization: `Bearer ${segredo}`, Cookie: `session=${segredo}` } });
  assert.equal(resposta.status, 200);
  await resposta.text();
  assert.ok(linhas.some(linha => linha.includes('http_resposta')));
  assert.ok(linhas.every(linha => !linha.includes(segredo) && !linha.includes('token=')));
} finally {
  console.log = logOriginal;
  await new Promise<void>(resolve => server.close(() => resolve()));
}
console.log('PASS logs: categorias seguras, sem segredo/conteúdo de erro, email indisponível falha com segurança, nome escapado.');

}
void main().catch(erro => { console.error(erro); process.exitCode = 1; });
