import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';

for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
  const url = new URL(process.env[key] ?? '');
  console.log(`${key}: ${url.hostname}:${url.port}${url.pathname}`);
  assert.equal(url.hostname, 'altaria.proxy.rlwy.net');
  assert.equal(url.port, '49931');
}
const db = new PrismaClient();
const nome = `teste-admin-${randomUUID()}`;
const email = `${nome}@example.invalid`;

async function main() {
  const { AuthService } = await import('../src/services/auth.service');
  try {
    const dados = { nome, email, senha: randomUUID(), papel: 'ADMIN' as const };
    const resultados = await Promise.allSettled([
      AuthService.registrar(dados),
      AuthService.registrar({ ...dados, email: ` ${email.toUpperCase()} ` }),
    ]);
    assert.equal(resultados.filter(r => r.status === 'fulfilled').length, 1);
    const rejeitado = resultados.find(r => r.status === 'rejected');
    assert.ok(rejeitado && rejeitado.status === 'rejected');
    assert.equal(rejeitado.reason.status, 409);
    assert.equal(await db.usuario.count({ where: { email, papel: 'ADMIN' } }), 1);
    assert.equal(await db.barbearia.count({ where: { nome: `Barbearia do ${nome}` } }), 1);
    await assert.rejects(AuthService.registrar(dados), { status: 409 });
    const outra = await db.barbearia.create({ data: { nome: `Barbearia do ${nome}`, slug: `${nome}-cliente` } });
    await AuthService.registrar({ ...dados, papel: 'CLIENTE', barbeariaId: outra.id });
    assert.equal(await db.usuario.count({ where: { email } }), 2);
    const login = await AuthService.login(dados);
    assert.equal(login.usuario.papel, 'ADMIN');
    const { default: app } = await import('../src/app');
    const server = app.listen(0, '127.0.0.1');
    try {
      await once(server, 'listening');
      const port = (server.address() as AddressInfo).port;
      const response = await fetch(`http://127.0.0.1:${port}/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...dados, email: ` ${email.toUpperCase()} ` }),
      });
      assert.equal(response.status, 409);
      assert.match((await response.json() as { erro: string }).erro, /já está cadastrado/);
      assert.equal(await db.barbearia.count({ where: { nome: `Barbearia do ${nome}` } }), 2);
      console.log('PASS HTTP: rota real recusa duplicidade com 409, sem criar barbearia nem enviar verificação.');
      const { VerificacaoService } = await import('../src/services/verificacao.service');
      const enviarOriginal = VerificacaoService.enviarCodigo;
      let verificacoes = 0;
      VerificacaoService.enviarCodigo = async () => { verificacoes++; };
      try {
        const novo = { ...dados, email: `novo-${email}` };
        const cadastro = await fetch(`http://127.0.0.1:${port}/auth/register`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(novo),
        });
        assert.equal(cadastro.status, 201);
        assert.equal(verificacoes, 1, 'cadastro mantém chamada de verificação; envio externo simulado');
        const entrada = await fetch(`http://127.0.0.1:${port}/auth/login`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(novo),
        });
        assert.equal(entrada.status, 200);
        const autenticado = await entrada.json() as { token: string; usuario: { email: string; barbeariaId: string } };
        assert.ok(autenticado.token);
        assert.equal(autenticado.usuario.email, novo.email);
        assert.equal(await db.usuario.count({ where: { email: novo.email, barbeariaId: autenticado.usuario.barbeariaId } }), 1);
        console.log('PASS HTTP: novo ADMIN recebe 201, verificação é chamada e login retorna 200 com a barbearia correta.');
      } finally {
        VerificacaoService.enviarCodigo = enviarOriginal;
      }
    } finally {
      await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
    }
    console.log('PASS PostgreSQL: concorrência real, um ADMIN/uma barbearia, resposta 409, cliente com mesmo email e login preservado.');
  } finally {
    // Somente fixtures com nome aleatório exclusivo deste teste, em postgres-dev.
    await db.barbearia.deleteMany({ where: { nome: `Barbearia do ${nome}` } });
    assert.equal(await db.usuario.count({ where: { email } }), 0);
    assert.equal(await db.barbearia.count({ where: { nome: `Barbearia do ${nome}` } }), 0);
    console.log('PASS limpeza: nenhuma fixture remanescente.');
    await db.$disconnect();
    const { prisma } = await import('../src/lib/prisma');
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
