import assert from 'node:assert/strict';
import { Client } from 'pg';
import { copiarBanco } from '../src/lib/dbSync';

const base = 'postgresql://preview@127.0.0.1:55432/';
const nomes = ['vb_backup_test_origem', 'vb_backup_test_destino', 'vb_backup_test_ledger'];
const admin = new Client({ connectionString: base + 'postgres' });
const schema = `CREATE TABLE IF NOT EXISTS pais (id text primary key, nome text NOT NULL);
 CREATE TABLE IF NOT EXISTS filhos (id text primary key, pai text REFERENCES pais(id));
 CREATE TABLE IF NOT EXISTS exclusoes_dados_auditaveis (id text primary key, entidade text, "registroId" text, "excluidoPrincipalEm" timestamp, "retencaoLegal" boolean);`;
async function main() {
  assert.equal(new URL(base).hostname, '127.0.0.1');
  assert.equal(new URL(base).port, '55432');
  await admin.connect();
  for (const nome of nomes) {
    assert.match(nome, /^vb_backup_test_/);
    if (!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [nome])).rowCount) await admin.query(`CREATE DATABASE "${nome}"`);
  }
  const dbs = nomes.map(n => new Client({ connectionString: base + n }));
  try {
    for (const db of dbs) { await db.connect(); await db.query(schema); await db.query('TRUNCATE pais, filhos, exclusoes_dados_auditaveis'); }
    const [origem, destino, ledger] = dbs;
    await origem.query("INSERT INTO pais VALUES ('p','Nome correto'); INSERT INTO filhos VALUES ('f','p')");
    await destino.query("INSERT INTO pais VALUES ('antigo','Preservar se falhar')");
    // DIRECT_URL inválida prova que cópia não executa DDL nem consulta essa variável.
    process.env.DIRECT_URL = 'postgresql://invalid@127.0.0.1:1/nao_usar';
    await copiarBanco(base + nomes[0], base + nomes[1]);
    assert.equal((await destino.query('SELECT nome FROM pais')).rows[0].nome, 'Nome correto');
    await assert.rejects(copiarBanco(base + nomes[0], base + nomes[1], { modo: 'RESTAURACAO' }), /ledger atual/);
    await ledger.query("INSERT INTO exclusoes_dados_auditaveis VALUES ('m','pais','p',now(),false)");
    // Filho sobrevivente impediria FK: deve falhar e reverter todo o destino.
    await assert.rejects(copiarBanco(base + nomes[0], base + nomes[1], { modo: 'RESTAURACAO', ledgerAtualUrl: base + nomes[2] }), /foreign key/);
    assert.equal((await destino.query('SELECT count(*) FROM filhos')).rows[0].count, '1');
    assert.equal((await destino.query('SELECT nome FROM pais')).rows[0].nome, 'Nome correto');
    await ledger.query("INSERT INTO exclusoes_dados_auditaveis VALUES ('m2','filhos','f',now(),false)");
    await copiarBanco(base + nomes[0], base + nomes[1], { modo: 'RESTAURACAO', ledgerAtualUrl: base + nomes[2] });
    assert.equal((await destino.query('SELECT count(*) FROM pais')).rows[0].count, '0');
    assert.equal((await destino.query('SELECT count(*) FROM exclusoes_dados_auditaveis')).rows[0].count, '2');
    await destino.query('ALTER TABLE pais ADD COLUMN divergente text');
    await assert.rejects(copiarBanco(base + nomes[0], base + nomes[1]), /Schema do destino/);
    await destino.query('ALTER TABLE pais DROP COLUMN divergente');
    console.log('PASS PostgreSQL local: cópia íntegra, DIRECT_URL ignorada, ledger obrigatório, exclusão posterior ao backup, rollback FK, schema divergente bloqueado.');
  } finally { for (const db of dbs) await db.end(); await admin.end(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
