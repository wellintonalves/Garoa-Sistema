import assert from 'node:assert/strict';
import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

async function main() {
  const base = process.env.IMPLANTACAO_TEST_DATABASE_URL;
  if (!base) throw new Error('Informe conexão com servidor PostgreSQL descartável local.');
  const parsed = new URL(base);
  assert.ok(['127.0.0.1', 'localhost'].includes(parsed.hostname) && parsed.port === '55434' && parsed.pathname === '/postgres');
  const name = `valen_implantacao_test_${Date.now()}`;
  const admin = new Client({ connectionString: base }); await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`); await admin.end();
  parsed.pathname = '/' + name;
  const db = new Client({ connectionString: parsed.toString() }); await db.connect();
  try {
    await db.query(readFileSync('backend/prisma/migrations/20260914_baseline/migration.sql', 'utf8'));
    await db.query(`INSERT INTO barbearias(id,nome,slug) VALUES ('b','Barbearia sintética','implantacao-teste');
      INSERT INTO usuarios(id,nome,email,senha,papel,"barbeariaId") VALUES ('u','Administrador sintético','admin@example.invalid','hash','ADMIN','b'),('ub','Barbeiro sintético','barbeiro@example.invalid','hash','BARBEIRO','b'),('uc','Cliente sintético','cliente@example.invalid','hash','CLIENTE','b');
      INSERT INTO barbeiros(id,"usuarioId","barbeariaId") VALUES ('bb','ub','b');
      INSERT INTO clientes(id,"usuarioId","barbeariaId") VALUES ('c','uc','b');
      INSERT INTO clientes_barbearias(id,"clienteId","barbeariaId") VALUES ('cb','c','b');
      INSERT INTO servicos(id,"barbeariaId",nome,preco,"duracaoMinutos") VALUES ('s','b','Serviço sintético',39.99,30);
      INSERT INTO agendamentos(id,"barbeariaId","clienteId","barbeiroId","servicoId","dataHora","valorCobrado") VALUES ('a','b','c','bb','s','2026-09-15 12:00:00',39.99);
      INSERT INTO lancamentos_financeiros(id,"barbeariaId",tipo,categoria,valor,"formaPagamento",data,"valorComissao","valorLiquido","agendamentoId","clienteId","barbeiroId") VALUES ('l','b','ENTRADA','Serviço',39.99,'PIX','2026-09-15',10,29.99,'a','c','bb');
      INSERT INTO pontos_fidelidade(id,"clienteId","barbeariaId","agendamentoId","lancamentoId",pontos,"saldoApos",descricao) VALUES ('p','c','b','a','l',10,10,'Acúmulo sintético');`);
    const tabelas = ['agendamentos', 'lancamentos_financeiros', 'pontos_fidelidade', 'clientes', 'barbeiros', 'servicos'];
    const antes = new Map<string, unknown>();
    for (const tabela of tabelas) antes.set(tabela, (await db.query(`SELECT * FROM ${tabela} ORDER BY id`)).rows);
    await db.query(readFileSync('docs/implantacao-cobranca.sql', 'utf8'));
    for (const tabela of tabelas) assert.deepEqual((await db.query(`SELECT * FROM ${tabela} ORDER BY id`)).rows, antes.get(tabela), tabela + ' preservada');
    assert.equal((await db.query('SELECT "legadoAssinatura" FROM barbearias WHERE id=$1', ['b'])).rows[0].legadoAssinatura, true);
    assert.equal((await db.query('SELECT ativo FROM clientes_barbearias WHERE id=$1', ['cb'])).rows[0].ativo, true);
    await db.query("INSERT INTO barbearias(id,nome,slug) VALUES ('nova','Nova sintética','nova-implantacao')");
    assert.equal((await db.query('SELECT "legadoAssinatura" FROM barbearias WHERE id=$1', ['nova'])).rows[0].legadoAssinatura, false);
    const diff = execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'migrate', 'diff', '--from-url', parsed.toString(), '--to-schema-datamodel', path.resolve('backend/prisma/schema.prisma'), '--script'], { encoding: 'utf8' });
    assert.match(diff, /empty migration/);
    await assert.rejects(db.query(readFileSync('docs/implantacao-cobranca.sql', 'utf8')), /already exists/);
    await db.query('ROLLBACK');
    assert.deepEqual((await db.query('SELECT * FROM lancamentos_financeiros ORDER BY id')).rows, antes.get('lancamentos_financeiros'));
    console.log('PASS pacote SQL local: sem drift; agendamentos, financeiro, comissões, fidelidade e histórico preservados; legados classificados; repetição aborta sem perda de dados.');
  } finally { await db.end(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
