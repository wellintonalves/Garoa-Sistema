// Somente leitura: executar com railway run --no-local. Não carrega .env nem imprime segredos.
import { Client } from 'pg';

async function main() {
  const flags = ['NODE_ENV', 'ASSINATURA_ASAAS_PRODUCTION_ENABLED', 'ASSINATURA_ASAAS_SANDBOX_ENABLED', 'ASSINATURA_JOBS_ENABLED', 'ASAAS_ENV'];
  for (const key of flags) console.log(`${key}: ${['true', 'false', 'production', 'sandbox'].includes(process.env[key] || '') ? process.env[key] : 'não configurado'}`);
  console.log('Chave Asaas presente:', Boolean(process.env.ASAAS_API_KEY));
  console.log('Token webhook adequado:', Boolean(process.env.ASAAS_WEBHOOK_TOKEN && process.env.ASAAS_WEBHOOK_TOKEN.length >= 32 && !/\s/.test(process.env.ASAAS_WEBHOOK_TOKEN)));
  const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!connectionString) { console.log('Banco: conexão não configurada'); return; }
  const db = new Client({ connectionString, connectionTimeoutMillis: 8000, statement_timeout: 8000 });
  try {
    await db.connect();
    await db.query('BEGIN READ ONLY');
    const tabelas = ['assinaturas_saas', 'mudancas_assinatura', 'eventos_webhook_asaas', 'solicitacoes_cancelamento_assinatura'];
    for (const tabela of tabelas) {
      const r = await db.query('SELECT to_regclass($1) IS NOT NULL AS presente', [`public.${tabela}`]);
      console.log(`Tabela ${tabela}: ${r.rows[0].presente ? 'presente' : 'ausente'}`);
    }
    const r = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'barbearias' AND column_name IN ('legadoAssinatura', 'avisoMigracaoEm', 'prazoMigracaoAte')`);
    console.log('Colunas de transição legada encontradas:', r.rows.map(x => x.column_name).join(', ') || 'nenhuma');
    await db.query('ROLLBACK');
  } catch { console.log('Banco: não foi possível concluir a consulta somente leitura'); process.exitCode = 1; }
  finally { await db.end(); }
}
main().catch(() => { console.error('Verificação interrompida sem expor configuração.'); process.exitCode = 1; });
