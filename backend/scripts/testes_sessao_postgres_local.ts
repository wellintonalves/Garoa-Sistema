import assert from 'node:assert/strict';
import { Client } from 'pg';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import express from 'express';
import type { AddressInfo } from 'node:net';

const run = promisify(execFile);
assert.equal(process.env.ALLOW_LOCAL_SECURITY_TEST, '1', 'Exige autorização explícita do runner local');
const counter = process.argv.includes('--counter');
const connection = new URL(process.env.DATABASE_URL ?? '');
for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
  const url = new URL(process.env[key] ?? '');
  assert.equal(url.protocol, 'postgresql:'); assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.port, '55439'); assert.equal(url.pathname, '/valen_sessao_test'); assert.equal(url.username, 'valen_test');
  assert.equal(url.hash, '');
  if (counter) {
    assert.deepEqual([...url.searchParams.keys()], ['schema']);
    assert.match(url.searchParams.get('schema') ?? '', /^auth_test_[a-f0-9]{12}$/);
  } else assert.equal(url.search, '', 'Não permitir parâmetros que redirecionem a conexão');
  assert.equal(url.toString(), connection.toString(), 'DATABASE_URL e DIRECT_URL devem ser idênticos');
}
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'postgres-synthetic-admin-secret-1234';
process.env.JWT_SECRET_CLIENTE = 'postgres-synthetic-client-secret-1234';
process.env.JWT_SECRET_BARBEIRO = 'postgres-synthetic-barber-secret-1234';
delete process.env.LEGACY_SESSION_CUTOFF;
delete process.env.RESEND_API_KEY;

async function main() {
  if (process.argv.includes('--counter')) {
    const { consumirOrcamento } = await import('../src/middlewares/rateLimit.middleware');
    for (let i=0;i<25;i++) await consumirOrcamento('real-process-shared-key',60_000);
    const { prisma } = await import('../src/lib/prisma'); await prisma.$disconnect(); return;
  }
  console.log('Banco sintético confirmado: 127.0.0.1:55439/valen_sessao_test; sem dados/provedores externos.');
  const schema = `auth_test_${randomBytes(6).toString('hex')}`;
  const setup = new Client({connectionString:connection.toString()}); await setup.connect();
  await setup.query(`CREATE SCHEMA "${schema}"`);
  await setup.query(`SET search_path TO "${schema}"`);
  connection.searchParams.set('schema',schema);
  process.env.DATABASE_URL = connection.toString(); process.env.DIRECT_URL = connection.toString();
  const root=resolve(__dirname,'../..');
  const { stdout }=await run(process.execPath,[resolve(root,'node_modules/prisma/build/index.js'),'migrate','diff','--from-empty','--to-schema-datamodel',resolve(root,'backend/prisma/schema.prisma'),'--script'],{cwd:root,env:process.env,maxBuffer:5*1024*1024});
  // Generate an old-schema fixture without the two new security additions; no db push/reset.
  const oldSql=stdout.replace(/^\s*"authVersion" INTEGER NOT NULL DEFAULT 0,\s*$/m,'')
    .replace(/CREATE TABLE "limites_autenticacao" \([\s\S]*?\);/,'')
    .replace(/CREATE INDEX "limites_autenticacao_expiraEm_idx"[\s\S]*?;/,'');
  await setup.query(oldSql);
  const senha='Senha-fixture-segura'; const hash=await bcrypt.hash(senha,4);
  await setup.query(`INSERT INTO barbearias(id,nome,slug) VALUES ('loja','Loja sintética','loja')`);
  for(const [id,papel] of [['admin','ADMIN'],['barber','BARBEIRO'],['client','CLIENTE']]) await setup.query(`INSERT INTO usuarios(id,nome,email,senha,papel,"barbeariaId","emailVerificado") VALUES ($1,$1,$2,$3,$4,'loja',true)`,[id,`${id}@example.test`,hash,papel]);
  await setup.query(`INSERT INTO barbeiros(id,"usuarioId","barbeariaId",especialidades) VALUES ('barber-profile','barber','loja',ARRAY[]::text[])`);
  await setup.query(`INSERT INTO clientes(id,"usuarioId","barbeariaId",observacoes) VALUES ('client-profile','client','loja','Histórico sintético preservado')`);
  await setup.query(`INSERT INTO servicos(id,nome,preco,"duracaoMinutos","barbeariaId") VALUES ('service','Corte',40,30,'loja')`);
  await setup.query(`INSERT INTO agendamentos(id,"clienteId","barbeiroId","servicoId","barbeariaId","dataHora","valorCobrado") VALUES ('history','client-profile','barber-profile','service','loja','2025-01-01T12:00:00Z',40)`);
  const oldUsers=(await setup.query('SELECT to_jsonb(u) AS value FROM usuarios u ORDER BY id')).rows;
  const history=(await setup.query('SELECT to_jsonb(a) AS value FROM agendamentos a ORDER BY id')).rows;
  const additive=await readFile(resolve(root,'backend/sql/seguranca-sessoes-limites.sql'),'utf8');
  await setup.query(additive); await setup.query(additive);
  assert.deepEqual((await setup.query(`SELECT to_jsonb(u)-'authVersion' AS value FROM usuarios u ORDER BY id`)).rows,oldUsers);
  assert.equal((await setup.query(`SELECT count(*)::int n FROM usuarios WHERE "authVersion"=0`)).rows[0].n,3);
  assert.deepEqual((await setup.query('SELECT to_jsonb(a) AS value FROM agendamentos a ORDER BY id')).rows,history);
  console.log('PASS: additive SQL is repeatable; existing users/booking history preserved, version defaults to zero.');

  await Promise.all(Array.from({length:8},()=>run(process.execPath,['--import','tsx',__filename,'--counter'],{cwd:root,env:process.env,maxBuffer:1_000_000})));
  assert.equal((await setup.query(`SELECT tentativas FROM limites_autenticacao WHERE chave='real-process-shared-key'`)).rows[0].tentativas,200);
  await setup.query(`UPDATE limites_autenticacao SET "expiraEm"=clock_timestamp()-interval '1 second' WHERE chave='real-process-shared-key'`);
  const { consumirOrcamento }=await import('../src/middlewares/rateLimit.middleware');
  assert.equal((await consumirOrcamento('real-process-shared-key',60_000)).tentativas,1);
  console.log('PASS: 8 real independent processes share an atomic PostgreSQL budget; expiry resets once.');

  const { prisma }=await import('../src/lib/prisma');
  const { default: authRoutes }=await import('../src/routes/auth.routes');
  const { default: barberRoutes }=await import('../src/routes/barbeiroApp.routes');
  const { errorMiddleware }=await import('../src/middlewares/error.middleware');
  const { BarbeiroService }=await import('../src/services/barbeiro.service');
  const app=express(); app.use(express.json()); app.use('/auth',authRoutes); app.use('/barbeiro',barberRoutes); app.use(errorMiddleware);
  const server=app.listen(0,'127.0.0.1'); await new Promise<void>(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  async function call(path:string,method='GET',body?:unknown,cookie?:string,extra:Record<string,string>={}) {
    const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json','X-Valen-Client':'web','X-Valen-Portal':'admin',Origin:'http://localhost:5173',...(cookie?{Cookie:cookie}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});
    return {status:r.status,body:await r.text(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
  }
  try {
    const login=await call('/auth/login','POST',{email:'admin@example.test',senha}); assert.equal(login.status,200,login.body); assert.ok(login.cookie); assert.ok(!JSON.parse(login.body).token);
    assert.equal((await call('/auth/session','GET',undefined,login.cookie)).status,200);
    assert.equal((await call('/auth/logout','POST',undefined,login.cookie,{Origin:'https://evil.example'})).status,403);
    const before=(await prisma.usuario.findUniqueOrThrow({where:{id:'admin'}})).authVersion;
    await prisma.usuario.update({where:{id:'admin'},data:{senha:await bcrypt.hash('nova-senha',4)}});
    assert.equal((await prisma.usuario.findUniqueOrThrow({where:{id:'admin'}})).authVersion,before+1);
    assert.equal((await call('/auth/session','GET',undefined,login.cookie)).status,401);
    const novo=await call('/auth/login','POST',{email:'admin@example.test',senha:'nova-senha'}); assert.equal(novo.status,200);
    assert.equal((await call('/auth/logout','POST',undefined,novo.cookie)).status,204);
    assert.equal((await call('/auth/session','GET',undefined,novo.cookie)).status,401);
    const barber=await call('/barbeiro/login','POST',{email:'barber@example.test',senha}); assert.equal(barber.status,200,barber.body);
    await BarbeiroService.desativar('barber-profile');
    assert.equal((await call('/barbeiro/session','GET',undefined,barber.cookie)).status,401);
    await BarbeiroService.atualizar('barber-profile',{ativo:true});
    assert.equal((await call('/barbeiro/session','GET',undefined,barber.cookie)).status,401);
    assert.ok((await prisma.usuario.findUniqueOrThrow({where:{id:'barber'}})).authVersion>=2);
    console.log('PASS: real Prisma/HTTP login-cookie, reload, CSRF, password reset version, logout and disable→enable invalidation.');
    assert.deepEqual((await setup.query('SELECT to_jsonb(a) AS value FROM agendamentos a ORDER BY id')).rows,history);
    console.log('PASS: booking historical rows unchanged after all authentication tests.');
  } finally { await new Promise<void>(r=>server.close(()=>r())); await prisma.$disconnect(); await setup.end(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
