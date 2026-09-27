import { Client, ClientConfig } from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type PapelBancoBackup = 'origem' | 'destino' | 'ledger';

/** TLS externo valida a cadeia e o hostname. A CA do Supabase fica restrita ao provedor. */
export function configuracaoConexaoBackup(url: string, papel: PapelBancoBackup): ClientConfig {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error(`URL inválida do banco de ${papel}.`); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || parsed.searchParams.has('host')) {
    throw new Error(`URL incompatível do banco de ${papel}; use o host na autoridade da URL.`);
  }
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname);
  const interno = parsed.hostname.endsWith('.railway.internal');
  const supabase = parsed.hostname.endsWith('.supabase.co') || parsed.hostname.endsWith('.supabase.com');
  const caFile = parsed.searchParams.get('sslrootcert') || process.env[`BACKUP_${papel.toUpperCase()}_CA_FILE`];
  if (parsed.searchParams.has('sslcert') || parsed.searchParams.has('sslkey')) {
    throw new Error(`Certificado de cliente não suportado na conexão de ${papel}.`);
  }
  // O pg substitui o objeto ssl quando esses parâmetros permanecem na URL.
  for (const key of ['ssl', 'sslmode', 'sslrootcert', 'uselibpqcompat']) parsed.searchParams.delete(key);
  let ca: string | undefined;
  if (!local && !interno && (caFile || supabase)) {
    try {
      ca = readFileSync(caFile || resolve(__dirname, '../../certs/supabase-prod-ca-2021.crt'), 'utf8');
    } catch { throw new Error(`Não foi possível ler o certificado CA do banco de ${papel}.`); }
  }
  return {
    connectionString: parsed.toString(),
    ssl: local || interno ? false : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    connectionTimeoutMillis: 15000,
  };
}

export function criarConexaoBackup(url: string, papel: PapelBancoBackup): Client {
  return new Client(configuracaoConexaoBackup(url, papel));
}

export async function conectarBancoBackup(client: Client, papel: PapelBancoBackup): Promise<void> {
  try { await client.connect(); } catch (error) {
    const rawCode = (error as { code?: unknown })?.code;
    const code = typeof rawCode === 'string' && /^[A-Z0-9_]+$/.test(rawCode) ? rawCode : 'CONEXAO_FALHOU';
    // Não propaga mensagens que possam conter URL, senha ou nome de usuário.
    throw new Error(`Falha ao conectar ao banco de ${papel} (${code}). Verifique conexão e certificado CA.`);
  }
}
