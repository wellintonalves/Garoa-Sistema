const {Client}=require('pg'),fs=require('fs'),{execFileSync}=require('child_process');
const root=require('path').resolve(__dirname,'..');
const database=process.argv.includes('--regression')?'valen_ia_test':'valen_ia_test_concessao';
const url='postgresql://barber_qa@127.0.0.1:55439/'+database;
(async()=>{
 const admin=new Client({connectionString:'postgresql://barber_qa@127.0.0.1:55439/postgres'});await admin.connect();
 if((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[database])).rowCount)throw new Error('Test database already exists; do not reset automatically');
 await admin.query('CREATE DATABASE '+database);await admin.end();
 const schema=execFileSync('git',['show','fe844c6:backend/prisma/schema.prisma'],{cwd:root,encoding:'utf8'});
 fs.writeFileSync(__dirname+'/ia-base-schema.prisma',schema);
 execFileSync(process.execPath,[root+'/node_modules/prisma/build/index.js','db','push','--skip-generate','--schema',__dirname+'/ia-base-schema.prisma'],{cwd:root,env:{...process.env,DATABASE_URL:url,DIRECT_URL:url},stdio:'inherit'});
 const db=new Client({connectionString:url});await db.connect();
 const base=fs.readFileSync(root+'/backend/prisma/migrations/20260927_base_ia/migration.sql','utf8');
 await db.query(base.slice(base.indexOf('ALTER TABLE ia_periodos ADD CONSTRAINT ia_periodos_limites')));
 await db.query('BEGIN');
 await db.query(fs.readFileSync(root+'/backend/prisma/migrations/20261002_concessao_ia/migration.sql','utf8'));
 await db.query('COMMIT');await db.end();console.log('ISOLATED_DATABASE_READY');
})().catch(e=>{console.error(e.message);process.exitCode=1});
