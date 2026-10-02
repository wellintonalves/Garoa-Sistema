const {spawnSync}=require('child_process'), fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'), url=process.env.DATABASE_PUBLIC_URL;
if(!url)throw new Error('Missing public database variable');
const after=process.argv.includes('--after');
const to=after?root+'/backend/prisma/schema.prisma':__dirname+'/ia-base-schema.prisma';
const r=spawnSync(process.execPath,[root+'/node_modules/prisma/build/index.js','migrate','diff','--from-schema-datasource',__dirname+'/ia-base-schema.prisma','--to-schema-datamodel',to,'--script','--exit-code'],{cwd:root,env:{...process.env,DATABASE_URL:url,DIRECT_URL:url},encoding:'utf8'});
fs.writeFileSync(__dirname+(after?'/ia-drift-after.sql':'/ia-drift-before.sql'),r.stdout||'');
console.log(JSON.stringify({exitCode:r.status,empty:/empty migration/i.test(r.stdout||''),sqlLines:(r.stdout||'').split('\n').length}));
if(r.status!==0)process.exitCode=1;
