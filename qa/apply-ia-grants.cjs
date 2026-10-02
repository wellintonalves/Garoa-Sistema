// Operação específica aprovada em 02/10/2026. Não recebe IDs/limites pelo navegador.
const {Client,types}=require('pg'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{randomUUID,createHash}=require('crypto');
types.setTypeParser(1114,v=>new Date(v.replace(' ','T')+'Z'));
const targets=[
 {id:'75c3f49a-b880-4603-93cf-b8130efbb9d5',nome:'Teste',slug:'garoa-barbearia',fim:'2026-11-16T03:00:00.000Z'},
 {id:'be18355d-575d-4bc8-a179-eea1106dc02a',nome:'garoa barbearia',slug:'barbearia-1782909453620',fim:'2026-10-28T03:00:00.000Z'},
 {id:'757f0caa-33e6-4409-96cb-c8c6fce85358',nome:'H Sousa Barbearia',slug:'barbearia-1787143080659',fim:'2026-10-26T03:00:00.000Z'},
];
const sql=fs.readFileSync(path.resolve(__dirname,'../backend/prisma/migrations/20261002_concessao_ia/migration.sql'),'utf8');
const connection=()=>new Client({connectionString:process.env.DATABASE_PUBLIC_URL,connectionTimeoutMillis:10000,statement_timeout:20000});
(async()=>{
 assert(process.argv.includes('--apply-approved'),'Explicit operation flag required');
 assert(process.env.DATABASE_PUBLIC_URL,'Railway public connection required');
 const db=connection();await db.connect();let committed=false;
 try {
  await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await db.query("SET LOCAL TIME ZONE 'UTC'");await db.query("SET LOCAL lock_timeout='5s'");
  assert.equal((await db.query("SELECT to_regclass('public.ia_concessoes') AS name")).rows[0].name,null,'Migration already present: inspect; never repeat blindly');
  for(const t of [...targets].sort((a,b)=>a.id.localeCompare(b.id)))await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[t.id]);
  const before=await db.query('SELECT * FROM barbearias WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',[targets.map(t=>t.id)]);
  assert.equal(before.rowCount,3);
  for(const t of targets){const b=before.rows.find(r=>r.id===t.id);assert.equal(b.nome,t.nome);assert.equal(b.slug,t.slug);assert.equal(b.ativo,true);assert.equal(b.legadoAssinatura,true);assert.equal(b.prazoMigracaoAte.toISOString(),t.fim);}
  const subscriptions=await db.query('SELECT * FROM assinaturas_saas WHERE "barbeariaId"=ANY($1::text[]) ORDER BY id FOR UPDATE',[targets.map(t=>t.id)]);
  assert.equal(subscriptions.rowCount,1);assert.equal(subscriptions.rows[0].barbeariaId,targets[0].id);assert.equal(subscriptions.rows[0].status,'PRE_CADASTRO');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM ia_periodos WHERE "barbeariaId"=ANY($1::text[])',[targets.map(t=>t.id)])).rows[0].n,0,'Existing consumption requires review, never reset');
  const oldPeriods=await db.query('SELECT * FROM ia_periodos ORDER BY id');
  await db.query(sql);
  const newPeriods=await db.query('SELECT * FROM ia_periodos ORDER BY id');
  assert.deepEqual(newPeriods.rows.map(({concessaoId,...rest})=>{assert.equal(concessaoId,null);return rest}),oldPeriods.rows);
  const start=(await db.query('SELECT clock_timestamp() AS now')).rows[0].now;
  for(const t of targets){assert(start<new Date(t.fim));await db.query('INSERT INTO ia_concessoes(id,"barbeariaId",inicio,fim,"mensagensLimite","creditosLimite","custoCreditoMicrousd") VALUES($1,$2,$3,$4,100,2000000,1)',[randomUUID(),t.id,start,t.fim]);}
  assert.deepEqual((await db.query('SELECT * FROM barbearias WHERE id=ANY($1::text[]) ORDER BY id',[targets.map(t=>t.id)])).rows,before.rows);
  assert.deepEqual((await db.query('SELECT * FROM assinaturas_saas WHERE "barbeariaId"=ANY($1::text[]) ORDER BY id',[targets.map(t=>t.id)])).rows,subscriptions.rows);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM ia_concessoes')).rows[0].n,3);
  await db.query('COMMIT');committed=true;
  console.log('COMMITTED: additive migration and exactly three approved grants; subscriptions and general access unchanged');
 } catch(e){if(!committed)await db.query('ROLLBACK').catch(()=>{});throw e}finally{await db.end()}
 const read=connection();await read.connect();try{
  await read.query('BEGIN READ ONLY');
  const r=await read.query('SELECT b.nome,b.slug,b.ativo,b."prazoMigracaoAte",c.inicio,c.fim,c."mensagensLimite",c."creditosLimite",c."custoCreditoMicrousd",c.revogada FROM ia_concessoes c JOIN barbearias b ON b.id=c."barbeariaId" ORDER BY b.nome');
  assert.equal(r.rowCount,3);for(const row of r.rows){const t=targets.find(t=>t.slug===row.slug);assert(t);assert.equal(row.fim.toISOString(),t.fim);assert.equal(row.prazoMigracaoAte.toISOString(),t.fim);}
  const result={verifiedAt:new Date().toISOString(),migrationSha256:createHash('sha256').update(sql).digest('hex'),rows:r.rows,subscriptionsUnchanged:true,generalAccessUnchanged:true,existingPeriodsUnchanged:true};
  fs.writeFileSync(__dirname+'/ia-grants-applied.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await read.query('ROLLBACK');
 }finally{await read.end()}
})().catch(e=>{console.error('OPERATION_FAILED',e.code||e.name);process.exitCode=1});
