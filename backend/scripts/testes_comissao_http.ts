import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
  const url = new URL(process.env[key] ?? '');
  assert.equal(url.hostname, 'altaria.proxy.rlwy.net');
  assert.equal(url.port, '49931');
}
const db = new PrismaClient();
const prefixo = `teste-http-comissao-${randomUUID()}`;
const rollback = new Error('ROLLBACK_TESTE');
let server: Server | undefined;
type TestExtension = { query: { $allModels: { $allOperations(input: {
  model: string; operation: string; args: unknown; query: (args: unknown) => Promise<unknown>;
}): Promise<unknown> } } };

async function main() {
  try {
    await db.$transaction(async tx => {
      // Todas as requisições HTTP usam a transação real, revertida ao final.
      const base = {
        $extends(extension: TestExtension) {
          const client = new Proxy({}, { get(_target, model: string) {
            if (model === '$transaction') return async (fn: (client: unknown) => Promise<unknown>) => fn(client);
            return new Proxy({}, { get(_delegate, operation: string) {
              return (args: unknown) => extension.query.$allModels.$allOperations({
                model: model[0].toUpperCase() + model.slice(1), operation, args,
                query: (scoped: unknown) => {
                  const delegate = Reflect.get(tx, model) as Record<string, (args: unknown) => Promise<unknown>>;
                  return delegate[operation](scoped);
                },
              });
            } });
          } });
          return client;
        },
      };
      (globalThis as typeof globalThis & { prisma?: unknown }).prisma = base;
      const { default: app } = await import('../src/app');
      const { authConfig } = await import('../src/config/auth');
      const shop = await tx.barbearia.create({ data: { nome: prefixo, slug: prefixo } });
      await tx.configuracao.create({ data: { barbeariaId: shop.id, baseCalculoComissao: 'VALOR_LIQUIDO' } });
      const user = await tx.usuario.create({ data: { nome: 'Barbeiro teste HTTP', email: `${prefixo}@example.invalid`, senha: 'sem-login', papel: 'BARBEIRO', barbeariaId: shop.id } });
      const barber = await tx.barbeiro.create({ data: { usuarioId: user.id, barbeariaId: shop.id, especialidades: [], comissaoPercent: 45 } });
      const token = jwt.sign({ id: 'admin-teste', nome: 'Teste HTTP', papel: 'ADMIN', barbeariaId: shop.id }, authConfig.secret, { expiresIn: '2m' });
      server = app.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Origin: 'http://127.0.0.1:5173' };
      const request = async (path: string, method: string, body?: unknown) => {
        const res = await fetch(baseUrl + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
        assert.ok(res.ok, `HTTP ${res.status}`);
        assert.equal(res.headers.get('access-control-allow-origin'), headers.Origin);
        return res.json();
      };
      const initial = await request('/financeiro', 'POST', { tipo: 'ENTRADA', categoria: 'Serviço', valor: 35,
        formaPagamento: 'PIX', data: '2026-09-09', barbeiroId: barber.id });
      assert.equal(Number(initial.valorComissao), 15.75);
      const edited = await request(`/financeiro/${initial.id}`, 'PUT', { valor: 40 });
      assert.equal(Number(edited.valorComissao), 18);
      assert.equal(Number(edited.valorLiquido), 22);
      console.log('PASS HTTP: editar 35 para 40 recalculou comissão 15,75 para 18 e líquido 22.');
      const forged = await request(`/financeiro/${initial.id}`, 'PUT', { valor: 40, valorComissao: 999 });
      assert.equal(Number(forged.valorComissao), 18);
      const persisted = await tx.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: initial.id } });
      assert.equal(Number(persisted.valorComissao), 18);
      assert.equal(Number(persisted.percentualComissao), 45);
      console.log('PASS HTTP e PostgreSQL: comissão enviada 999 ignorada; persistida 18 e percentual 45.');
      // Alterar a taxa atual não deve reescrever o percentual do atendimento antigo.
      await tx.barbeiro.update({ where: { id: barber.id }, data: { comissaoPercent: 40 } });
      const preservado = await request(`/financeiro/${initial.id}`, 'PUT', { valor: 60 });
      assert.equal(Number(preservado.percentualComissao), 45);
      assert.equal(Number(preservado.valorComissao), 27);
      assert.equal(Number(preservado.valorLiquido), 33);
      const historico = await tx.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: initial.id } });
      assert.equal(Number(historico.percentualComissao), 45);
      assert.equal(Number(historico.valorComissao), 27);
      assert.equal((await tx.barbeiro.findUniqueOrThrow({ where: { id: barber.id } })).comissaoPercent, 40);
      console.log('PASS histórico HTTP e PostgreSQL: barbeiro a 40%, lançamento manteve 45%; comissão 27 sobre valor 60.');
      console.log('PASS CORS: origem numérica local autorizada em todas as respostas.');
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
      server = undefined;
      throw rollback;
    }, { timeout: 120000, maxWait: 10000 });
  } catch (error) { if (error !== rollback) throw error; }
  assert.equal(await db.barbearia.count({ where: { nome: prefixo } }), 0);
  assert.equal(await db.usuario.count({ where: { email: `${prefixo}@example.invalid` } }), 0);
  console.log('PASS rollback: nenhum dado de teste persistiu. Teste HTTP automatizado; não substitui conferência visual.');
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Falha no teste'); process.exitCode = 1; })
  .finally(async () => { server?.closeAllConnections(); server?.close(); await db.$disconnect(); });
