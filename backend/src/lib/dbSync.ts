import { Client } from 'pg';
import { createHash } from 'node:crypto';
import { filtrarReintroducaoEmRestauracao, MarcadorExclusao } from '../domain/privacidade/retencaoBackup';

const ident = (s: string) => '"' + s.replace(/"/g, '""') + '"';
function connection(url: string) {
  const parsed = new URL(url);
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname);
  return new Client({ connectionString: url, ssl: local || parsed.hostname.endsWith('.railway.internal') ? false : { rejectUnauthorized: true } });
}
function sameDatabase(a: string, b: string) {
  const x = new URL(a), y = new URL(b);
  return x.hostname === y.hostname && x.port === y.port && x.pathname === y.pathname;
}
const digest = (rows: unknown[]) => createHash('sha256').update(rows.map(row => JSON.stringify(row)).sort().join('\n')).digest('hex');

/** Destinos devem ter schema previamente migrado. Nunca executa DDL nem lê .env. */
export async function copiarBanco(sourceUrl: string, targetUrl: string,
  opcoes: { modo?: 'BACKUP' | 'RESTAURACAO'; ledgerAtualUrl?: string } = {}) {
  if (sameDatabase(sourceUrl, targetUrl)) throw new Error('Origem e destino devem ser bancos distintos.');
  if (opcoes.modo === 'RESTAURACAO' && (!opcoes.ledgerAtualUrl || sameDatabase(opcoes.ledgerAtualUrl, sourceUrl) || sameDatabase(opcoes.ledgerAtualUrl, targetUrl))) {
    throw new Error('Restauração exige ledger atual independente do backup e do destino; operação bloqueada.');
  }
  const inicio = Date.now();
  const origem = connection(sourceUrl), destino = connection(targetUrl);
  const ledger = opcoes.ledgerAtualUrl ? connection(opcoes.ledgerAtualUrl) : undefined;
  let origemTx = false, destinoTx = false;
  try {
    await origem.connect(); await destino.connect();
    await origem.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); origemTx = true;
    await destino.query('BEGIN'); destinoTx = true;
    // Uma cópia por destino; outras transações não veem dados parcialmente restaurados.
    await destino.query("SELECT pg_advisory_xact_lock(hashtext('valen-backup-copy'))");
    const schemaSQL = `SELECT table_name, column_name, udt_name, is_nullable, column_default
      FROM information_schema.columns WHERE table_schema='public' AND table_name <> '_prisma_migrations'
      ORDER BY table_name, ordinal_position`;
    const schema = (await origem.query(schemaSQL)).rows;
    const alvoSchema = (await destino.query(schemaSQL)).rows;
    if (JSON.stringify(schema) !== JSON.stringify(alvoSchema)) throw new Error('Schema do destino difere da origem; aplique a migração revisada antes da cópia.');
    const tabelas: string[] = [...new Set<string>(schema.map(r => r.table_name))];
    if (!tabelas.length) throw new Error('Origem sem tabelas de aplicação.');
    const fks = (await destino.query(`SELECT c.relname AS filha, p.relname AS pai FROM pg_constraint fk
      JOIN pg_class c ON c.oid=fk.conrelid JOIN pg_class p ON p.oid=fk.confrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace WHERE fk.contype='f' AND n.nspname='public'`)).rows;
    const ordem: string[] = [];
    while (ordem.length < tabelas.length) {
      const proximas = tabelas.filter(t => !ordem.includes(t) && fks.filter(f => f.filha === t && f.pai !== t).every(f => ordem.includes(f.pai)));
      if (!proximas.length) throw new Error('Dependências cíclicas exigem procedimento de restauração específico.');
      ordem.push(...proximas);
    }
    let marcadores: MarcadorExclusao[] = [];
    let ledgerRows: any[] | undefined;
    if (opcoes.modo === 'RESTAURACAO') {
      await ledger!.connect();
      await ledger!.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      ledgerRows = (await ledger!.query('SELECT * FROM "exclusoes_dados_auditaveis"')).rows;
      marcadores = ledgerRows as MarcadorExclusao[];
      if (!tabelas.includes('exclusoes_dados_auditaveis')) throw new Error('Backup anterior ao ledger exige migração isolada antes da restauração.');
    }
    // Sem CASCADE: uma dependência externa inesperada causa rollback, nunca exclusão implícita.
    await destino.query(`TRUNCATE TABLE ${tabelas.map(ident).join(', ')}`);
    let totalLinhas = 0;
    for (const tabela of ordem) {
      const dados = tabela === 'exclusoes_dados_auditaveis' && ledgerRows ? ledgerRows : (await origem.query(`SELECT * FROM ${ident(tabela)}`)).rows;
      const rows = opcoes.modo === 'RESTAURACAO' ? filtrarReintroducaoEmRestauracao(tabela, dados, marcadores) : dados;
      if (rows.length) {
        const cols = Object.keys(rows[0]);
        const batchSize = Math.min(250, Math.floor(60000 / cols.length));
        for (let i = 0; i < rows.length; i += batchSize) {
          const valores: unknown[] = [];
          const placeholders = rows.slice(i, i + batchSize).map(row => '(' + cols.map(col => { const tipo = schema.find(c => c.table_name === tabela && c.column_name === col)?.udt_name; valores.push(['json', 'jsonb'].includes(tipo) && row[col] !== null ? JSON.stringify(row[col]) : row[col]); return '$' + valores.length; }).join(',') + ')');
          await destino.query(`INSERT INTO ${ident(tabela)} (${cols.map(ident).join(',')}) VALUES ${placeholders.join(',')}`, valores);
        }
      }
      const salvo = (await destino.query(`SELECT * FROM ${ident(tabela)}`)).rows;
      if (digest(rows) !== digest(salvo)) throw new Error(`Verificação de conteúdo falhou: ${tabela}`);
      totalLinhas += rows.length;
    }
    await destino.query('COMMIT'); destinoTx = false;
    await origem.query('COMMIT'); origemTx = false;
    return { tabelas: tabelas.length, totalLinhas, duracaoMs: Date.now() - inicio };
  } catch (error) {
    if (destinoTx) await destino.query('ROLLBACK').catch(() => {});
    if (origemTx) await origem.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await origem.end().catch(() => {}); await destino.end().catch(() => {});
    if (ledger) await ledger.end().catch(() => {});
  }
}
