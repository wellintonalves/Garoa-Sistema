import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';

for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
  const url = new URL(process.env[key] ?? '');
  console.log(`${key}: ${url.hostname}:${url.port}${url.pathname}`);
  assert.equal(url.hostname, 'altaria.proxy.rlwy.net');
  assert.equal(url.port, '49931');
}
const db = new PrismaClient();
const nome = `teste-inativa-${randomUUID()}`;
async function main() {
  const { AuthService } = await import('../src/services/auth.service');
  const { BarbeiroAppService } = await import('../src/services/barbeiroApp.service');
  const { authMiddleware } = await import('../src/middlewares/auth.middleware');
  const { barbeiroAuthMiddleware } = await import('../src/middlewares/barbeiroAuth.middleware');
  const { errorMiddleware } = await import('../src/middlewares/error.middleware');
  const { authConfig } = await import('../src/config/auth');
  const app = express();
  app.get('/admin', authMiddleware, (_req, res) => { res.json({ ok: true }); });
  app.get('/barbeiro', barbeiroAuthMiddleware, (_req, res) => { res.json({ ok: true }); });
  app.use(errorMiddleware);
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const origem = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const consultar = (rota: string, token: string) => fetch(origem + rota, { headers: { Authorization: `Bearer ${token}` } });
    const senha = randomUUID();
    const hash = await bcrypt.hash(senha, 4);
    const antiga = await db.barbearia.create({ data: { nome, slug: `${nome}-antiga` } });
    const atual = await db.barbearia.create({ data: { nome, slug: `${nome}-atual` } });
    for (const b of [antiga, atual]) {
      await db.usuario.create({ data: { nome, email: `${nome}@example.invalid`, senha: hash, papel: 'ADMIN', barbeariaId: b.id } });
      await db.barbeiro.create({ data: {
        barbearia: { connect: { id: b.id } }, especialidades: [],
        usuario: { create: { nome, email: `barbeiro-${nome}@example.invalid`, senha: hash, papel: 'BARBEIRO', barbeariaId: b.id } },
      } });
    }
    const adminAntigo = await AuthService.login({ email: `${nome}@example.invalid`, senha, papel: 'ADMIN', barbeariaId: antiga.id });
    const barbeiroAntigo = await BarbeiroAppService.login(`barbeiro-${nome}@example.invalid`, senha, antiga.id);
    assert.equal((await consultar('/admin', adminAntigo.token)).status, 200);
    assert.equal((await consultar('/barbeiro', barbeiroAntigo.token)).status, 200);
    await db.barbearia.update({ where: { id: antiga.id }, data: { ativo: false } });
    assert.equal((await consultar('/admin', adminAntigo.token)).status, 403);
    assert.equal((await consultar('/admin', barbeiroAntigo.token)).status, 403);
    assert.equal((await consultar('/barbeiro', barbeiroAntigo.token)).status, 403);
    const { barbeariaId: _ignorado, ...legado } = barbeiroAntigo.barbeiro;
    const tokenLegado = jwt.sign(legado, authConfig.secretBarbeiro, { expiresIn: '1m' });
    assert.equal((await consultar('/admin', tokenLegado)).status, 403);
    assert.equal((await consultar('/barbeiro', tokenLegado)).status, 403);
    await assert.rejects(AuthService.login({ email: `${nome}@example.invalid`, senha, papel: 'ADMIN', barbeariaId: antiga.id }), { status: 401 });
    await assert.rejects(BarbeiroAppService.login(`barbeiro-${nome}@example.invalid`, senha, antiga.id), { status: 403 });
    const adminAtual = await AuthService.login({ email: `${nome}@example.invalid`, senha, papel: 'ADMIN' });
    assert.equal(adminAtual.usuario.barbeariaId, atual.id);
    const barbeiroAtual = await BarbeiroAppService.login(`barbeiro-${nome}@example.invalid`, senha);
    assert.equal(barbeiroAtual.barbeiro.barbeariaId, atual.id);
    assert.equal((await consultar('/admin', adminAtual.token)).status, 200);
    assert.equal((await consultar('/barbeiro', barbeiroAtual.token)).status, 200);
    assert.equal(await db.usuario.count({ where: { barbeariaId: antiga.id } }), 2);
    await db.barbearia.update({ where: { id: antiga.id }, data: { ativo: true } });
    assert.equal((await consultar('/admin', adminAntigo.token)).status, 200);
    console.log('PASS: loja inativa bloqueia novos logins e tokens existentes/legados; conta ativa com mesmo email entra; dados preservados; reativação reversível.');
  } finally {
    await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
    await db.barbearia.deleteMany({ where: { nome } });
    assert.equal(await db.barbearia.count({ where: { nome } }), 0);
    assert.equal(await db.usuario.count({ where: { nome } }), 0);
    await db.$disconnect();
    const { prisma } = await import('../src/lib/prisma');
    await prisma.$disconnect();
    console.log('PASS limpeza das fixtures de desenvolvimento.');
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
