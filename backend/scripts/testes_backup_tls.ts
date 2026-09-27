import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import tls from 'node:tls';
import { Client } from 'pg';
import { configuracaoConexaoBackup, conectarBancoBackup } from '../src/lib/backupConnection';

async function main() {
  const url = 'postgresql://usuario:segredo@db.example.supabase.co:5432/postgres';
  const config = configuracaoConexaoBackup(url, 'destino');
  const ssl = config.ssl as tls.ConnectionOptions;
  assert.equal(ssl.rejectUnauthorized, true);
  const ca = new X509Certificate(ssl.ca as string);
  assert.equal(ca.ca, true);
  assert.equal(ca.fingerprint256, '80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA');
  assert.ok(Date.parse(ca.validTo) > Date.now());
  // Verifica a configuração efetiva do driver, não apenas o objeto produzido pelo helper.
  for (const query of ['sslmode=require', 'sslmode=no-verify', 'ssl=false', 'sslmode=disable&uselibpqcompat=true']) {
    const client = new Client(configuracaoConexaoBackup(`${url}?${query}`, 'destino'));
    assert.equal((client as any).connectionParameters.ssl.rejectUnauthorized, true);
    assert.equal((client as any).connectionParameters.ssl.ca, ssl.ca);
    await client.end();
  }
  assert.equal(configuracaoConexaoBackup('postgres://u@db.railway.internal/db', 'origem').ssl, false);
  assert.equal(configuracaoConexaoBackup('postgres://u@127.0.0.1/db', 'origem').ssl, false);
  assert.equal((configuracaoConexaoBackup('postgres://u@supabase.co.example.org/db', 'destino').ssl as tls.ConnectionOptions).ca, undefined);
  assert.throws(() => configuracaoConexaoBackup('postgres://u@localhost/db?host=externo.example', 'origem'), /incompatível/);
  await assert.rejects(conectarBancoBackup({ connect: async () => { throw Object.assign(new Error(url), { code: 'SELF_SIGNED_CERT_IN_CHAIN' }); } } as unknown as Client, 'destino'), error => {
    assert.match((error as Error).message, /destino.*SELF_SIGNED_CERT_IN_CHAIN/);
    assert.ok(!(error as Error).message.includes('segredo'));
    return true;
  });
  const dir = mkdtempSync(join(tmpdir(), 'valen-backup-tls-'));
  const openssl = process.env.BACKUP_TEST_OPENSSL || (process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl');
  const previousCA = process.env.BACKUP_DESTINO_CA_FILE;
  let server: tls.Server | undefined;
  try {
    execFileSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(dir, 'key.pem'), '-out', join(dir, 'ca.pem'), '-days', '1', '-subj', '/CN=backup.example.test', '-addext', 'subjectAltName=DNS:backup.example.test'], { stdio: 'ignore' });
    const cert = readFileSync(join(dir, 'ca.pem'));
    server = tls.createServer({ key: readFileSync(join(dir, 'key.pem')), cert }, socket => socket.end());
    server.on('tlsClientError', () => {});
    await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
    process.env.BACKUP_DESTINO_CA_FILE = join(dir, 'ca.pem');
    const trusted = configuracaoConexaoBackup('postgres://u@backup.example.test/db', 'destino').ssl as tls.ConnectionOptions;
    const handshake = (options: tls.ConnectionOptions, servername = 'backup.example.test') => new Promise<void>((resolve, reject) => {
      const socket = tls.connect({ ...options, host: '127.0.0.1', port: (server!.address() as import('node:net').AddressInfo).port, servername }, () => { socket.end(); resolve(); });
      socket.setTimeout(3000, () => socket.destroy(new Error('Timeout TLS')));
      socket.on('error', reject);
    });
    await handshake(trusted);
    await assert.rejects(handshake({ rejectUnauthorized: true }), /self-signed certificate/);
    await assert.rejects(handshake(trusted, 'outro.example.test'), /Hostname\/IP does not match/);
  } finally {
    if (previousCA === undefined) delete process.env.BACKUP_DESTINO_CA_FILE;
    else process.env.BACKUP_DESTINO_CA_FILE = previousCA;
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    rmSync(dir, { recursive: true, force: true });
  }
  console.log('PASS backup TLS: CA oficial, precedência da URL, cadeia confiável, rejeição de CA desconhecida e hostname incorreto, erro sem credenciais.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
