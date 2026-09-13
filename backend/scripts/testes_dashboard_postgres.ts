import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
  const url = new URL(process.env[key] ?? '');
  console.log(`${key}: ${url.hostname}:${url.port}${url.pathname}`);
  assert.equal(url.hostname, 'altaria.proxy.rlwy.net');
  assert.equal(url.port, '49931');
}
const db = new PrismaClient();
const prefixo = `teste-dashboard-${randomUUID()}`;
async function main() {
  const { authConfig } = await import('../src/config/auth');
  // Exercita o build que o Railway executa, sem iniciar backups/jobs.
  const { default: app } = await import('../dist/app');
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const lojas = await Promise.all(['a', 'b'].map(s => db.barbearia.create({ data: { nome: prefixo, slug: `${prefixo}-${s}` } })));
    const [a, b] = lojas;
    const data = new Date('2026-09-10T15:00:00Z');
    await db.lancamentoFinanceiro.createMany({ data: [
      { barbeariaId: a.id, tipo: 'ENTRADA', categoria: 'Serviço Prestado', valor: 40, formaPagamento: 'PIX', data },
      { barbeariaId: a.id, tipo: 'ENTRADA', categoria: 'Serviço', valor: 20, formaPagamento: 'PIX', data },
      { barbeariaId: a.id, tipo: 'ENTRADA', categoria: 'Venda de Produto', valor: 50, formaPagamento: 'PIX', data },
      { barbeariaId: a.id, tipo: 'ENTRADA', categoria: 'Aporte', valor: 100, formaPagamento: 'PIX', data },
      { barbeariaId: a.id, tipo: 'SAIDA', categoria: 'Despesa', valor: 10, formaPagamento: 'PIX', data },
      { barbeariaId: a.id, tipo: 'ENTRADA', categoria: 'Serviço', valor: 15, formaPagamento: 'PIX', data: new Date('2026-09-09T15:00:00Z') },
      { barbeariaId: b.id, tipo: 'ENTRADA', categoria: 'Serviço Prestado', valor: 80, formaPagamento: 'PIX', data },
    ] });
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/financeiro/dashboard?inicio=2026-09-10&fim=2026-09-10`;
    for (const loja of lojas) {
      const token = jwt.sign({ id: randomUUID(), nome: 'Teste', email: 'teste@example.invalid', papel: 'ADMIN', barbeariaId: loja.id }, authConfig.secret, { expiresIn: '2m' });
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(response.status, 200);
      const r = await response.json() as { atendimentosFechados: number; ticketMedio: number; faturamentoTotal: number; totalAtendimentos: number; metricas: { atendimentosFechados: { serie: number[]; anterior: number } } };
      assert.equal(r.atendimentosFechados, loja.id === a.id ? 2 : 1);
      assert.equal(r.ticketMedio, loja.id === a.id ? 30 : 80);
      assert.equal(r.faturamentoTotal, loja.id === a.id ? 210 : 80);
      assert.equal(r.totalAtendimentos, 0);
      assert.equal(r.metricas.atendimentosFechados.anterior, loja.id === a.id ? 1 : 0);
      assert.equal(r.metricas.atendimentosFechados.serie.reduce((s, n) => s + n, 0), r.atendimentosFechados);
    }
    console.log('PASS HTTP/compilado/PostgreSQL: manual sem serviço conta; produtos, saídas e aporte não contam; ticket/comparativo corretos; duas barbearias isoladas.');
  } finally {
    await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
    await db.barbearia.deleteMany({ where: { nome: prefixo } });
    assert.equal(await db.barbearia.count({ where: { nome: prefixo } }), 0);
    console.log('PASS limpeza de fixtures.');
    await db.$disconnect();
    const { prisma } = await import('../dist/lib/prisma');
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
