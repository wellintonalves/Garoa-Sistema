// Executar via railway run; não carrega .env, não escreve no banco e não exibe segredos.
// Sem argumento: configuração. --banco: catálogo do Postgres público do serviço.
const { Client } = require('pg');
const campos = ['IA_ENABLED', 'IA_PERSISTENCIA_ENABLED', 'IA_VOZ_ENABLED',
  'OPENAI_TEXT_MODEL', 'OPENAI_VOICE_MODEL', 'IA_MENSAGENS_BASICO', 'IA_MENSAGENS_PRO',
  'IA_CREDITOS_BASICO', 'IA_CREDITOS_PRO', 'IA_CUSTO_CREDITO_MICROUSD',
  'IA_VOZ_CREDITOS', 'IA_CONTAGEM_TEXTO', 'IA_POLITICA_VERSAO', 'IA_TARIFA_VERSAO',
  'IA_TARIFA_ENTRADA_MICROUSD_MILHAO', 'IA_TARIFA_SAIDA_MICROUSD_MILHAO',
  'IA_RESULTADO_RETENCAO_HORAS', 'VITE_VALERIA_LANCAMENTO_ENABLED'];
async function main() {
  if (!process.argv.includes('--banco')) {
    console.log(JSON.stringify({ configuracao: Object.fromEntries(campos.map(k => [k, process.env[k] || null])),
      segredosPresentes: Object.fromEntries(['OPENAI_API_KEY', 'IA_RESULTADO_CHAVE_BASE64', 'IA_VOZ_TICKET_SECRET'].map(k => [k, Boolean(process.env[k])])) }, null, 2));
    return;
  }
  const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('BANCO_NAO_CONFIGURADO');
  const db = new Client({ connectionString: url, connectionTimeoutMillis: 12000,
    options: '-c default_transaction_read_only=on -c statement_timeout=15000' });
  try {
    await db.connect();
    await db.query('BEGIN READ ONLY');
    const tabelas = await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'ia_%' ORDER BY 1");
    const triggers = await db.query("SELECT event_object_table, trigger_name FROM information_schema.triggers WHERE event_object_schema='public' AND event_object_table LIKE 'ia_%'");
    const historico = await db.query("SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS existe");
    console.log(JSON.stringify({ somenteLeitura: true, tabelas: tabelas.rows, triggers: triggers.rows, historicoPrisma: historico.rows[0].existe }, null, 2));
    await db.query('ROLLBACK');
  } finally { await db.end(); }
}
main().catch(e => { console.error(JSON.stringify({ verificado: false, codigo: e.code || 'FALHA_DE_VERIFICACAO' })); process.exitCode = 1; });
