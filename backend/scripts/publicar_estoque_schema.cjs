// Manual release tool. Default is read-only; never run from application startup.
const { Client } = require('pg');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');

const q = value => '"' + value.replaceAll('"', '""') + '"';
const baseParent = {
  id: ['text', false], barbeariaId: ['text', false], chaveRequisicao: ['text', false],
  total: ['numeric(10,2)', false], formaPagamento: ['"FormaPagamento"', false],
  data: ['timestamp(3) without time zone', false, 'CURRENT_TIMESTAMP'], lancamentoId: ['text', false],
};
const optionalParent = {
  descontoManual: ['numeric(10,2)', true], descontoPercentual: ['numeric(10,2)', true],
  descontoPontos: ['numeric(10,2)', true], pontosUtilizados: ['integer', true],
  tipoDesconto: ['"TipoDesconto"', true], valorBruto: ['numeric(10,2)', true],
  valorDesconto: ['numeric(10,2)', true], estornadaEm: ['timestamp(3) without time zone', true],
  estornadoPorId: ['text', true], estornoLancamentoId: ['text', true], motivoEstorno: ['text', true],
};
const oldStock = {
  id: ['text',false], barbeariaId:['text',true], nome:['text',false], quantidade:['integer',false],
  unidade:['text',false], quantidadeMinima:['integer',false], custo:['numeric(10,2)',false], precoVenda:['numeric(10,2)',true],
};
const oldItems = {
  id:['text',false], barbeariaId:['text',true], estoqueId:['text',true], nomeProduto:['text',false],
  quantidade:['integer',false], precoVenda:['numeric(10,2)',false], custoUnitario:['numeric(10,2)',false],
  lucro:['numeric(10,2)',false], formaPagamento:['"FormaPagamento"',false], data:['timestamp(3) without time zone',false],
};
const files = ['estoque-venda-composta.sql','estoque-descontos.sql','estoque-estorno.sql'];

async function columns(db, table) {
  return (await db.query(`SELECT a.attname AS name, format_type(a.atttypid,a.atttypmod) AS type,
    NOT a.attnotnull AS nullable, pg_get_expr(d.adbin,d.adrelid) AS def, a.attidentity AS identity, a.attgenerated AS generated
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname='public' AND c.relname=$1 AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`, [table])).rows;
}
function verifyColumn(actual, expected, defaults = true) {
  assert(actual, 'Coluna obrigatoria ausente');
  assert.equal(actual.type, expected[0], `Tipo divergente: ${actual.name}`);
  assert.equal(actual.nullable, expected[1], `Nullabilidade divergente: ${actual.name}`);
  assert.equal(actual.identity, '', 'Identity inesperada');
  assert.equal(actual.generated, '', 'Coluna gerada inesperada');
  if (defaults) assert.equal(actual.def, expected[2] ?? null, `Default divergente: ${actual.name}`);
}
async function baseline(db) {
  for (const [table, old, additions] of [
    ['estoque',oldStock,{categoria:['text',true]}],
    ['vendas_produtos',oldItems,{vendaId:['text',true],descontoRateado:['numeric(10,2)',true]}],
  ]) {
    const rows = await columns(db,table);
    for (const [name, spec] of Object.entries(old)) verifyColumn(rows.find(c=>c.name===name),spec,false);
    for (const row of rows) {
      assert(row.name in old || row.name in additions, `Coluna inesperada em ${table}: ${row.name}`);
      if (row.name in additions) verifyColumn(row, additions[row.name]);
    }
  }
  const parent = await columns(db,'vendas_estoque');
  if (parent.length) {
    for (const [name,spec] of Object.entries(baseParent)) verifyColumn(parent.find(c=>c.name===name),spec);
    for (const row of parent) {
      assert(row.name in baseParent || row.name in optionalParent, 'Coluna inesperada na venda composta');
      if (row.name in optionalParent) verifyColumn(row,optionalParent[row.name]);
    }
    const pk = (await db.query(`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
      WHERE conrelid='public.vendas_estoque'::regclass AND contype='p'`)).rows;
    assert.deepEqual(pk,[{definition:'PRIMARY KEY (id)'}],'Chave primaria divergente');
  }
  for (const table of ['barbearias','lancamentos_financeiros']) {
    const rows=await columns(db,table); verifyColumn(rows.find(c=>c.name==='id'),['text',false],false);
  }
  for (const name of ['FormaPagamento','TipoDesconto']) {
    const result=await db.query('SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname=$1 AND t.typname=$2 AND t.typtype=$3',['public',name,'e']);
    assert.equal(result.rowCount,1,'Enum esperado ausente');
  }
}
async function existingIndex(db, table, name, names, unique) {
  const rows=(await db.query(`SELECT i.indisunique AS unique, i.indisvalid AS valid, i.indisready AS ready,
    i.indnkeyatts=i.indnatts AS no_include, i.indpred IS NULL AS no_predicate, i.indexprs IS NULL AS no_expression,
    am.amname AS method, array_agg(a.attname::text ORDER BY k.ordinality) AS columns,
    bool_and(k.option=0) AS default_order
    FROM pg_class ix JOIN pg_namespace n ON n.oid=ix.relnamespace JOIN pg_index i ON i.indexrelid=ix.oid
    JOIN pg_class t ON t.oid=i.indrelid JOIN pg_am am ON am.oid=ix.relam
    JOIN LATERAL unnest(i.indkey,i.indoption) WITH ORDINALITY k(attnum,option,ordinality) ON true
    JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.attnum
    WHERE n.nspname='public' AND ix.relname=$1 AND t.relname=$2
    GROUP BY i.indisunique,i.indisvalid,i.indisready,i.indnkeyatts,i.indnatts,i.indpred,i.indexprs,am.amname`,[name,table])).rows;
  if (!rows.length) {
    const collision=await db.query('SELECT to_regclass($1) AS rel',[`public.${name}`]);
    assert.equal(collision.rows[0].rel,null,'Nome de indice ocupado por objeto incompativel');
    return false;
  }
  assert.deepEqual(rows,[{unique,valid:true,ready:true,no_include:true,no_predicate:true,no_expression:true,method:'btree',columns:names,default_order:true}],`Indice divergente: ${name}`);
  return true;
}
async function existingForeignKey(db, table, name, column, target, targetColumn) {
  const rows=(await db.query(`SELECT c.contype AS type, c.confdeltype AS del, c.confupdtype AS upd,
    c.confmatchtype AS match, c.condeferrable AS deferred, c.convalidated AS valid,
    c.condeferred AS initially_deferred, nt.nspname AS target_schema, t.relname AS target,
    ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(n,o) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.n ORDER BY k.o) AS columns,
    ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(n,o) JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.n ORDER BY k.o) AS target_columns
    FROM pg_constraint c JOIN pg_class s ON s.oid=c.conrelid JOIN pg_namespace ns ON ns.oid=s.relnamespace
    LEFT JOIN pg_class t ON t.oid=c.confrelid LEFT JOIN pg_namespace nt ON nt.oid=t.relnamespace
    WHERE ns.nspname='public' AND s.relname=$1 AND c.conname=$2`,[table,name])).rows;
  if (!rows.length) return false;
  assert.deepEqual(rows,[{type:'f',del:'r',upd:'c',match:'s',deferred:false,valid:true,initially_deferred:false,target_schema:'public',target,columns:[column],target_columns:[targetColumn]}],`FK divergente: ${name}`);
  return true;
}
function operations(file) {
  const text=readFileSync(resolve(__dirname,'../../docs',file),'utf8').replace(/^--.*$/gm,'');
  return text.split(';').map(s=>s.trim()).filter(s=>s && !/^(BEGIN|COMMIT)$/.test(s)).flatMap(sql=>{
    const multiple=sql.match(/^ALTER TABLE "([^"]+)"\s+(ADD COLUMN[\s\S]+)$/);
    if (multiple) return multiple[2].split(/,\s*(?=ADD COLUMN)/).map(part=>`ALTER TABLE "${multiple[1]}" ${part}`);
    return [sql];
  });
}
async function present(db, sql) {
  let m=sql.match(/^ALTER TABLE "([^"]+)" ADD COLUMN "([^"]+)" ([\s\S]+)$/);
  if (m) {
    const specs=m[1]==='estoque'?{categoria:['text',true]}:m[1]==='vendas_produtos'?{vendaId:['text',true],descontoRateado:['numeric(10,2)',true]}:optionalParent;
    assert(specs[m[2]],'Coluna nao autorizada no SQL');
    const ddlTypes={'text':'TEXT','numeric(10,2)':'DECIMAL(10,2)','integer':'INTEGER','timestamp(3) without time zone':'TIMESTAMP(3)','"TipoDesconto"':'"TipoDesconto"'};
    assert.equal(m[3].trim(),ddlTypes[specs[m[2]][0]],'DDL da coluna divergiu do manifesto');
    const row=(await columns(db,m[1])).find(c=>c.name===m[2]);
    if (!row) return false;
    verifyColumn(row,specs[m[2]]); return true;
  }
  if (/^CREATE TABLE "vendas_estoque" /.test(sql)) {
    const rows=await columns(db,'vendas_estoque');
    if (!rows.length) return false;
    await baseline(db); return true;
  }
  m=sql.match(/^CREATE (UNIQUE )?INDEX "([^"]+)" ON "([^"]+)"\(([^)]+)\)$/);
  if (m) return existingIndex(db,m[3],m[2],[...m[4].matchAll(/"([^"]+)"/g)].map(x=>x[1]),!!m[1]);
  m=sql.match(/^ALTER TABLE "([^"]+)" ADD CONSTRAINT "([^"]+)"\s+FOREIGN KEY \("([^"]+)"\) REFERENCES "([^"]+)"\("([^"]+)"\) ON DELETE RESTRICT ON UPDATE CASCADE$/);
  if (m) return existingForeignKey(db,...m.slice(1));
  throw new Error('SQL fora das operacoes aditivas reconhecidas');
}
async function snapshot(db,table) {
  const rows=await columns(db,table); if (!rows.length) return null;
  const names=rows.map(c=>c.name);
  const result=await db.query(`SELECT ${names.map(q).join(',')} FROM public.${q(table)} ORDER BY id`);
  return {names,count:result.rowCount,hash:createHash('sha256').update(JSON.stringify(result.rows)).digest('hex')};
}
async function verifySnapshot(db,table,before) {
  if (!before) {assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.${q(table)}`)).rows[0].n,0);return;}
  const result=await db.query(`SELECT ${before.names.map(q).join(',')} FROM public.${q(table)} ORDER BY id`);
  assert.equal(result.rowCount,before.count,'Contagem alterada pela migracao');
  assert.equal(createHash('sha256').update(JSON.stringify(result.rows)).digest('hex'),before.hash,'Registros alterados pela migracao');
}
async function main() {
  const args=process.argv.slice(2); assert(args.every(x=>['--dev','--check','--apply'].includes(x)),'Argumento desconhecido');
  const dev=args.includes('--dev'), apply=args.includes('--apply');
  assert(!(apply && args.includes('--check')),'Modos conflitantes');
  if(dev) require('dotenv').config({path:resolve(__dirname,'../.env')});
  const url=new URL(dev?process.env.DATABASE_URL:process.env.DATABASE_PUBLIC_URL);
  assert.equal(url.host,dev?'altaria.proxy.rlwy.net:49931':'hayabusa.proxy.rlwy.net:30563'); assert.equal(url.pathname,'/railway');
  if(!dev) {
    assert.equal(process.env.RAILWAY_PROJECT_ID,'356da47a-81c8-46be-8767-b43abba26079');
    assert.equal(process.env.RAILWAY_ENVIRONMENT_ID,'f6f12f36-8c1c-4cd9-a1ec-66b1551974d7');
    assert.equal(process.env.RAILWAY_SERVICE_ID,'a4e75705-d647-46e6-8b15-8c20f6938197');
  }
  console.log(JSON.stringify({mode:apply?'apply':'check',host:url.host,database:url.pathname}));
  const db=new Client({connectionString:url.toString(),connectionTimeoutMillis:15000,statement_timeout:30000});
  try {
    await db.connect();
    for(const file of files) {
      await db.query(apply?'BEGIN':'BEGIN READ ONLY');
      try {
        await db.query("SET LOCAL search_path = public, pg_catalog");
        await db.query("SET LOCAL lock_timeout = '5s'");
        await baseline(db);
        const exists=(await columns(db,'vendas_estoque')).length>0;
        if(apply) await db.query(`LOCK TABLE public.estoque, public.vendas_produtos${exists?', public.vendas_estoque':''} IN SHARE ROW EXCLUSIVE MODE`);
        const before={}; if(apply) for(const table of ['estoque','vendas_produtos','vendas_estoque']) before[table]=await snapshot(db,table);
        let changed=0, skipped=0;
        for(const sql of operations(file)) {
          if(await present(db,sql)){skipped++;continue;}
          changed++;
          if(apply){await db.query(sql);assert(await present(db,sql),'DDL sem efeito esperado');}
        }
        if(apply) {
          await baseline(db);
          for(const [table,snap] of Object.entries(before)) await verifySnapshot(db,table,snap);
        }
        await db.query('COMMIT');
        console.log(JSON.stringify({file,operations:changed,alreadyPresent:skipped,committed:apply,preserved:apply?true:undefined}));
      } catch(error) {await db.query('ROLLBACK');throw error;}
    }
  } finally {await db.end();}
}
main().catch(error=>{console.error(JSON.stringify({error:error.message,code:error.code??null}));process.exitCode=1;});
