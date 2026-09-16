import assert from 'node:assert/strict';
import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import path from 'node:path';

async function main() {
  const base = 'postgresql://preview@127.0.0.1:55432/';
  const nome = 'vb_limites_clientes_' + Date.now();
  assert.equal(new URL(base).hostname, '127.0.0.1'); assert.equal(new URL(base).port, '55432');
  const admin = new Client({ connectionString: base + 'postgres' }); await admin.connect();
  await admin.query(`CREATE DATABASE "${nome}"`); await admin.end();
  const db = new Client({ connectionString: base + nome }); await db.connect();
  const prisma = new PrismaClient({ datasources: { db: { url: base + nome } } });
  try {
    for (const m of ['20260914_baseline', '20260915_assinatura_privacidade', '20260916_aceite_transicao']) {
      await db.query(readFileSync(path.resolve(__dirname, '../prisma/migrations', m, 'migration.sql'), 'utf8'));
    }
    await db.query(`INSERT INTO barbearias(id,nome,slug) VALUES ('a','A teste','a'),('b','B teste','b');
      INSERT INTO assinaturas_saas(id,"barbeariaId",plano,periodicidade,status,"precoCicloCentavos","updatedAt") VALUES
      ('a','a','BASICO','MENSAL','ATIVA',3999,now()),('b','b','BASICO','MENSAL','ATIVA',3999,now());
      INSERT INTO usuarios(id,nome,email,senha,papel) SELECT 'u'||n,'Cliente '||n,'u'||n||'@example.invalid','hash','CLIENTE' FROM generate_series(1,201) n;
      INSERT INTO clientes(id,"usuarioId","barbeariaId") SELECT 'c'||n,'u'||n,'a' FROM generate_series(1,201) n;
      INSERT INTO clientes_barbearias(id,"clienteId","barbeariaId",ativo) VALUES
      ('arq','c1','a',false),('ativo-a','c2','a',true),('ativo-b','c2','b',true);`);
    const { obterUsoAssinatura, validarVagaCliente } = await import('../src/services/limitesAssinatura.service');
    assert.equal((await obterUsoAssinatura(prisma as any, 'a')).clientesAtivos, 200,
      'arquivado com scalar A não conta; ativo com scalar+join conta uma vez; legados sem join contam');
    assert.equal((await obterUsoAssinatura(prisma as any, 'b')).clientesAtivos, 1, 'cliente compartilhado conta só uma vez em B');
    await assert.rejects(validarVagaCliente(prisma as any, 'a'), /200 clientes ativos/);
    await db.query("INSERT INTO clientes_barbearias(id,\"clienteId\",\"barbeariaId\",ativo) VALUES ('arq3','c3','a',false)");
    assert.equal((await validarVagaCliente(prisma as any, 'a')).clientesAtivos, 199, 'arquivamento libera vaga');
    await prisma.$transaction(async tx => {
      await validarVagaCliente(tx, 'a');
      await tx.clienteBarbearia.update({ where: { id: 'arq' }, data: { ativo: true } });
    }, { isolationLevel: 'Serializable' });
    assert.equal((await obterUsoAssinatura(prisma as any, 'a')).clientesAtivos, 200, 'reativação consome uma vaga');
    await assert.rejects(prisma.$transaction(async tx => {
      await validarVagaCliente(tx, 'a');
      await tx.clienteBarbearia.update({ where: { id: 'arq3' }, data: { ativo: true } });
    }, { isolationLevel: 'Serializable' }), /200 clientes ativos/);
    assert.equal((await prisma.clienteBarbearia.findUnique({ where: { id: 'arq3' } }))!.ativo, false);
    await db.query("UPDATE clientes_barbearias SET ativo=false WHERE id='ativo-a'");
    assert.equal((await obterUsoAssinatura(prisma as any, 'a')).clientesAtivos, 199);
    assert.equal((await obterUsoAssinatura(prisma as any, 'b')).clientesAtivos, 1, 'arquivamento em A preserva vaga ativa de B');
    console.log('PASS PostgreSQL: arquivado scalar+join excluído, legado sem join incluído, unique por cliente/unidade, teto200 e reativação transacional. Banco: ' + nome);
  } finally { await prisma.$disconnect(); await db.end(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
