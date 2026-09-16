import assert from 'node:assert/strict';
import { Client } from 'pg';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { copiarBanco } from '../src/lib/dbSync';

async function main() {
  const root = path.resolve(__dirname, '../..');
  const work = path.join(root, '.tmp/migration-audit'); mkdirSync(work, { recursive: true });
  const prismaCli = path.join(root, 'node_modules/prisma/build/index.js');
  const initialSQL = readFileSync(path.join(root, 'backend/prisma/migrations/20260914_baseline/migration.sql'), 'utf8');
  const name = 'vb_migration_audit_' + Date.now();
  const url = 'postgresql://preview@127.0.0.1:55432/' + name;
  assert.equal(new URL(url).hostname, '127.0.0.1'); assert.equal(new URL(url).port, '55432');
  const admin = new Client({ connectionString: 'postgresql://preview@127.0.0.1:55432/postgres' });
  await admin.connect(); await admin.query(`CREATE DATABASE "${name}"`); await admin.end();
  const db = new Client({ connectionString: url }); await db.connect();
  try {
    await db.query(initialSQL);
    await db.query(`INSERT INTO barbearias(id,nome,slug) VALUES ('legado','Barbearia fictícia','legado-audit');
      INSERT INTO usuarios(id,nome,email,senha,papel,"barbeariaId") VALUES ('admin','Admin fictício','audit@example.invalid','hash-ficticio','ADMIN','legado');
      INSERT INTO lancamentos_financeiros(id,"barbeariaId",tipo,categoria,valor,"formaPagamento",data,"valorComissao","valorLiquido") VALUES ('financeiro','legado','ENTRADA','teste',39.99,'PIX',now(),10,29.99);`);
    const antes = (await db.query('SELECT * FROM lancamentos_financeiros')).rows;
    for (const migration of ['20260915_assinatura_privacidade', '20260916_aceite_transicao']) {
      await db.query(readFileSync(path.join(root, 'backend/prisma/migrations', migration, 'migration.sql'), 'utf8'));
    }
    assert.deepEqual((await db.query('SELECT * FROM lancamentos_financeiros')).rows, antes);
    assert.equal((await db.query('SELECT "legadoAssinatura" FROM barbearias')).rows[0].legadoAssinatura, true);
    assert.equal((await db.query('SELECT "aceiteDocumentosEm" FROM usuarios')).rows[0].aceiteDocumentosEm, null);
    await db.query("INSERT INTO barbearias(id,nome,slug) VALUES ('nova','Nova fictícia','nova-audit')");
    assert.equal((await db.query('SELECT "legadoAssinatura" FROM barbearias WHERE id=$1', ['nova'])).rows[0].legadoAssinatura, false);
    const diff = execFileSync(process.execPath, [prismaCli, 'migrate', 'diff', '--from-url', url, '--to-schema-datamodel', path.join(root, 'backend/prisma/schema.prisma'), '--script'], { cwd: root, encoding: 'utf8' });
    writeFileSync(path.join(work, 'schema-after-migrations.sql'), diff);
    assert.match(diff, /empty migration/);
    const targetName = name + '_backup';
    const control = new Client({ connectionString: 'postgresql://preview@127.0.0.1:55432/postgres' });
    await control.connect(); await control.query(`CREATE DATABASE "${targetName}"`); await control.end();
    const targetURL = 'postgresql://preview@127.0.0.1:55432/' + targetName;
    const target = new Client({ connectionString: targetURL }); await target.connect();
    try {
      await target.query(initialSQL);
      for (const migration of ['20260915_assinatura_privacidade', '20260916_aceite_transicao']) {
        await target.query(readFileSync(path.join(root, 'backend/prisma/migrations', migration, 'migration.sql'), 'utf8'));
      }
      const copy = await copiarBanco(url, targetURL);
      assert.ok(copy.tabelas > 20);
      assert.deepEqual((await target.query('SELECT * FROM lancamentos_financeiros')).rows, antes);
    } finally { await target.end(); }
    const result = `PASS: baseline versionado -> duas migrations -> schema atual sem drift; financeiro/comissão preservados; aceite legado null; cutoff classifica legado e não nova conta. Banco local ${name}.\n`;
    writeFileSync(path.join(work, 'resultado.txt'), result); console.log(result);
  } finally { await db.end(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });

