import assert from 'node:assert/strict';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'node:net';

process.env.JWT_SECRET = 'sessao-teste-admin-secret-synthetic';
process.env.JWT_SECRET_CLIENTE = 'sessao-teste-cliente-secret-synthetic';
process.env.JWT_SECRET_BARBEIRO = 'sessao-teste-barbeiro-secret-synthetic';
process.env.NODE_ENV = 'test';
delete process.env.RESEND_API_KEY;
const realNow = Date.now;
let now = realNow();
Date.now = () => now;
const senha = 'Senha-sintetica-123';
const users = new Map<string, any>();
const budgets = new Map<string, { tentativas: number; expiraEm: Date }>();
let extension: any;
const fake: any = {
  usuario: {
    findUnique: async ({ where }: any) => structuredClone(users.get(where.id) ?? null),
    findMany: async ({ where }: any) => [...users.values()].filter(u => (!where.email || u.email.toLowerCase() === (where.email.equals ?? where.email)) && (!where.papel || where.papel === u.papel) && (!where.barbeariaId || where.barbeariaId === u.barbeariaId) && (!where.OR || u.barbeariaId === null || u.barbearia?.ativo)).map(u => structuredClone(u)),
    findFirst: async ({ where }: any) => structuredClone([...users.values()].find(u => u.email === (where.email.equals ?? where.email) && u.papel === where.papel && u.barbeariaId === where.barbeariaId) ?? null),
    update: async ({ where, data }: any) => { const u = users.get(where.id); for (const [k,v] of Object.entries(data)) u[k] = k === 'authVersion' ? u.authVersion + (v as any).increment : v; return u; },
    updateMany: async ({ where, data }: any) => { const list = [...users.values()].filter(u => !where.id || u.id === where.id); for (const u of list) await fake.usuario.update({ where: { id: u.id }, data }); return { count: list.length }; },
  },
  barbeiro: {
    findFirst: async ({ where }: any) => { const u = [...users.values()].find(u => u.id === where.usuarioId && u.barbeiro?.ativo && u.barbeariaId === where.barbeariaId); return u?.barbeiro ?? null; },
    findUnique: async ({ where }: any) => { const u = [...users.values()].find(u => u.barbeiro?.id === where.id); return u ? { ...u.barbeiro, usuarioId: u.id } : null; },
    update: async ({ where, data }: any) => { const u = [...users.values()].find(u => u.barbeiro?.id === where.id); if (data.usuario?.update?.authVersion) u.authVersion += data.usuario.update.authVersion.increment; Object.assign(u.barbeiro, { ...data, usuario: undefined }); return u.barbeiro; },
  },
  barbearia: { findUnique: async ({ where }: any) => ({ id: 'loja', slug: where.slug ?? 'loja', ativo: true }) },
  $queryRaw: async (_sql: TemplateStringsArray, key: string, duration: number) => {
    const previous = budgets.get(key);
    const budget = previous && previous.expiraEm.getTime() > now ? { ...previous, tentativas: previous.tentativas + 1 } : { tentativas: 1, expiraEm: new Date(now + duration) };
    budgets.set(key, budget); return [budget];
  },
  $executeRaw: async (sql: TemplateStringsArray, id?: string) => { if (sql.join('').startsWith('UPDATE usuarios')) users.get(id!).authVersion++; return 1; },
  $transaction: async (fn: any) => typeof fn === 'function' ? fn(fake) : Promise.all(fn),
};
(globalThis as any).prisma = { $extends: (e: unknown) => { extension = e; return fake; } };

async function main() {
  const hash = await bcrypt.hash(senha, 4);
  for (const [id, papel, scoped] of [['admin','ADMIN',true], ['barber','BARBEIRO',true], ['customer','CLIENTE',false], ['tenant','CLIENTE',true]] as const) {
    users.set(id, { id, nome: id, email: `${id}@example.test`, senha: hash, papel, barbeariaId: scoped ? 'loja' : null, authVersion: 0, emailVerificado: true,
      barbearia: scoped ? { ativo: true, slug: 'loja' } : null,
      barbeiro: papel === 'BARBEIRO' ? { id: 'barber-profile', barbeariaId: 'loja', ativo: true, barbearia: { id: 'loja', nome: 'Loja', slug: 'loja', ativo: true } } : null,
      cliente: papel === 'CLIENTE' ? { id: `${id}-profile`, barbeariaId: scoped ? 'loja' : null } : null,
    });
  }
  const { AuthService } = await import('../src/services/auth.service');
  const { BarbeiroService } = await import('../src/services/barbeiro.service');
  const { VerificacaoService } = await import('../src/services/verificacao.service');
  VerificacaoService.enviarCodigo = async () => undefined;
  const { default: auth } = await import('../src/routes/auth.routes');
  const { default: client } = await import('../src/routes/clienteApp.routes');
  const { default: barber } = await import('../src/routes/barbeiroApp.routes');
  const { default: tenant } = await import('../src/routes/tenantRoutes');
  const { errorMiddleware } = await import('../src/middlewares/error.middleware');
  const { iniciarSessao, nomeCookie } = await import('../src/services/sessao.service');
  const app = express(); app.use(express.json());
  app.use('/auth', auth); app.use('/cliente', client); app.use('/barbeiro', barber); app.use('/b', tenant);
  app.use(errorMiddleware);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  async function call(path: string, method = 'GET', body?: unknown, cookie?: string, extra: Record<string,string> = {}) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Valen-Client': 'web', Origin: 'http://localhost:5173', ...(cookie ? { Cookie: cookie } : {}), ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.text(), cookie: response.headers.get('set-cookie'), retry: response.headers.get('retry-after') };
  }
  const pair = (header: string | null) => { assert.ok(header); return header.split(';')[0]; };
  try {
    const login = await call('/auth/login','POST',{email:'admin@example.test',senha});
    assert.equal(login.status,200,login.data); assert.ok(!JSON.parse(login.data).token); assert.match(login.cookie!,/HttpOnly/); assert.match(login.cookie!,/SameSite=Lax/); assert.match(login.cookie!,/Path=\//);
    let cookie = pair(login.cookie);
    assert.equal((await call('/auth/session','GET',undefined,cookie)).status,200);
    assert.equal((await call('/barbeiro/session','GET',undefined,cookie)).status,401);
    assert.equal((await call('/auth/login','POST',{email:'admin@example.test',senha},undefined,{Origin:'https://evil.example'})).status,403);
    assert.equal((await call('/auth/logout','POST',undefined,cookie,{Origin:''})).status,403);
    assert.equal((await call('/auth/session','GET',undefined,cookie,{'X-Valen-Client':''})).status,403);
    const legacy = jwt.sign({id:'admin', papel:'ADMIN', barbeariaId:'loja'},process.env.JWT_SECRET!,{expiresIn:'7d'});
    assert.equal((await call('/auth/session','GET',undefined,undefined,{Authorization:`Bearer ${legacy}`})).status,401);
    assert.equal((await call('/auth/session','GET',undefined,`${nomeCookie('admin')}=${legacy}`)).status,401);
    assert.equal((await call('/auth/session','GET',undefined,cookie+'; '+cookie)).status,401);
    console.log('PASS: cookie HttpOnly, reload, isolation, strict Origin/header, duplicate cookie and legacy bearer rejection.');

    users.get('admin').senha = await bcrypt.hash('changed',4);
    assert.equal((await call('/auth/session','GET',undefined,cookie)).status,401);
    users.get('admin').senha = hash; users.get('admin').authVersion++;
    assert.equal((await call('/auth/session','GET',undefined,cookie)).status,401);
    cookie = pair((await call('/auth/login','POST',{email:'admin@example.test',senha})).cookie);
    assert.equal((await call('/auth/logout','POST',undefined,cookie)).status,204);
    assert.equal((await call('/auth/session','GET',undefined,cookie)).status,401);
    console.log('PASS: credential digest, durable authVersion and logout revoke old cookies.');

    let barberCookie = pair((await call('/barbeiro/login','POST',{email:'barber@example.test',senha})).cookie);
    await BarbeiroService.desativar('barber-profile');
    assert.equal((await call('/barbeiro/session','GET',undefined,barberCookie)).status,401);
    await assert.rejects(AuthService.login({email:'barber@example.test',senha}),/incorretos/);
    assert.equal((await call('/b/loja/auth/login','POST',{email:'barber@example.test',senha})).status,401);
    users.get('barber').barbeiro.ativo = true;
    assert.equal((await call('/barbeiro/session','GET',undefined,barberCookie)).status,401);
    console.log('PASS: disabled barber rejected via generic/dedicated/legacy aliases; reactivation does not revive cookie.');

    users.get('customer').emailVerificado = false;
    const bad = await call('/cliente/login','POST',{email:'customer@example.test',senha:'wrong'}); assert.equal(bad.status,401); assert.ok(!JSON.parse(bad.data).usuarioId);
    const challenge = await call('/cliente/login','POST',{email:'customer@example.test',senha}); assert.equal(challenge.status,403); assert.equal(JSON.parse(challenge.data).usuarioId,'customer'); assert.equal(challenge.cookie,null);
    users.get('customer').emailVerificado = true;
    assert.equal((await call('/cliente/login','POST',{email:'customer@example.test',senha})).status,200);
    users.get('tenant').emailVerificado = false;
    const tenantChallenge=await call('/b/loja/auth/login','POST',{email:'tenant@example.test',senha}); assert.equal(tenantChallenge.status,403); assert.equal(JSON.parse(tenantChallenge.data).usuarioId,'tenant');
    console.log('PASS: unverified accounts get password-proven verification continuation, never a protected session.');

    budgets.clear();
    users.get('admin').authVersion = 0;
    process.env.LEGACY_SESSION_CUTOFF = new Date(now + 10*60_000).toISOString();
    const bridgeHeaders = { 'X-Valen-Client': '', Authorization: `Bearer ${legacy}` };
    assert.equal((await call('/auth/session','GET',undefined,undefined,bridgeHeaders)).status,401, 'original v1 never accepted, even during bridge');
    const oldLogin=await call('/auth/login','POST',{email:'admin@example.test',senha},undefined,{'X-Valen-Client':''});
    assert.equal(oldLogin.status,200); const bridgeToken=JSON.parse(oldLogin.data).token; assert.ok(bridgeToken);
    const bridgeClaims=jwt.decode(bridgeToken) as jwt.JwtPayload; assert.equal(bridgeClaims.v,'bridge'); assert.ok(bridgeClaims.exp!-bridgeClaims.iat!<=300);
    assert.equal((await call('/auth/session','GET',undefined,undefined,{'X-Valen-Client':'',Authorization:`Bearer ${bridgeToken}`})).status,200);
    const cookieAsBearer=pair(oldLogin.cookie).split('=')[1];
    assert.equal((await call('/auth/session','GET',undefined,undefined,{Authorization:`Bearer ${cookieAsBearer}`})).status,401);
    users.get('admin').authVersion++;
    assert.equal((await call('/auth/session','GET',undefined,undefined,bridgeHeaders)).status,401);
    assert.equal((await call('/auth/session','GET',undefined,undefined,{Authorization:`Bearer ${bridgeToken}`})).status,401);
    process.env.LEGACY_SESSION_CUTOFF = new Date(now + 31*60_000).toISOString();
    assert.equal((await call('/auth/session','GET',undefined,undefined,bridgeHeaders)).status,401, 'unsafe far-future bridge stays disabled');
    process.env.LEGACY_SESSION_CUTOFF = new Date(now - 1).toISOString();
    assert.equal((await call('/auth/session','GET',undefined,undefined,{Authorization:`Bearer ${legacy}`})).status,401);
    delete process.env.LEGACY_SESSION_CUTOFF;
    const previousTenant=users.get('admin').barbeariaId; users.get('admin').barbeariaId=null;
    assert.equal((await call('/auth/login','POST',{email:'admin@example.test',senha})).status,401, 'null-tenant admin never gets broad session');
    users.get('admin').barbeariaId=previousTenant;
    console.log('PASS: default-off bounded release bridge, short legacy login, cookie/bearer isolation, revocation, cutoff and null-tenant admin rejection.');

    budgets.clear(); cookie = pair((await call('/auth/login','POST',{email:'admin@example.test',senha})).cookie);
    now += 6*60_000;
    const renewed = await call('/auth/session','GET',undefined,cookie); assert.equal(renewed.status,200); assert.ok(renewed.cookie);
    const claims = jwt.decode(pair(renewed.cookie).split('=')[1]) as jwt.JwtPayload;
    assert.equal(claims.exp! - claims.iat!, 120*60);
    cookie = pair(renewed.cookie); now += 120*60_000+1000;
    assert.equal((await call('/auth/session','GET',undefined,cookie)).status,401);
    budgets.clear();
    let absoluteCookie=pair((await call('/auth/login','POST',{email:'admin@example.test',senha})).cookie);
    for (let hour=1;hour<12;hour++) {
      now+=60*60_000;
      const active=await call('/auth/session','GET',undefined,absoluteCookie); assert.equal(active.status,200);
      absoluteCookie=pair(active.cookie);
    }
    now+=60*60_000;
    assert.equal((await call('/auth/session','GET',undefined,absoluteCookie)).status,401,'activity never extends twelve-hour absolute session limit');
    console.log('PASS: rolling staff idle expiry and absolute12h limit remain bounded under continual activity.');

    budgets.clear();
    for (let i=0;i<25;i++) assert.equal((await call('/auth/login','POST',{email:`person${i}@example.test`,senha})).status,401,'unrelated accounts behind one proxy are not collectively blocked');
    const paths=['/auth/login','/cliente/login','/barbeiro/login','/b/loja/auth/login'];
    for (let i=0;i<8;i++) assert.notEqual((await call(paths[i%4],'POST',{email:i%2?' Alias@EXAMPLE.test ':'alias@example.test',senha},undefined,{'X-Forwarded-For':`198.51.100.${i}`})).status,429);
    const limited=await call('/auth/login','POST',{email:'alias@example.test',senha}); assert.equal(limited.status,429); assert.ok(limited.retry);
    assert.ok([...budgets.keys()].every(k=>!k.includes('@')&&!k.includes('127.0.0.1')));
    console.log('PASS: shared account quota spans aliases/case/forged IPs, distinct users remain usable, stored keys are opaque.');

    for (const field of ['senha','email','papel','barbeariaId','emailVerificado']) {
      const args:any={data:{[field]:'value'}};
      await extension.query.$allModels.$allOperations({ model:'Usuario',operation:'updateMany',args,query: async(a:any)=>a });
      assert.deepEqual(args.data.authVersion,{increment:1});
    }
    const unchanged:any={data:{nome:'Profile'}}; await extension.query.$allModels.$allOperations({model:'Usuario',operation:'update',args:unchanged,query:async(a:any)=>a}); assert.equal(unchanged.data.authVersion,undefined);
    // Production cookie contract can be checked without opening a secure transport or any live service.
    process.env.NODE_ENV='production'; let captured:any;
    await iniciarSessao({get:(h:string)=>h==='X-Valen-Client'?'web':h==='Origin'?'https://valenbarber.com.br':undefined,method:'POST'} as any,{cookie:(...args:any[])=>{captured=args;},setHeader:()=>undefined} as any,'admin','admin');
    assert.match(captured[0],/^__Host-/); assert.equal(captured[2].secure,true); assert.equal(captured[2].httpOnly,true); assert.equal(captured[2].domain,undefined);
    console.log('PASS: security mutations increment version atomically; profile-only update unaffected; production __Host/Secure cookie contract.');
  } finally { Date.now=realNow; await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve())); }
}
main().catch(error=>{Date.now=realNow;console.error(error);process.exitCode=1;});
