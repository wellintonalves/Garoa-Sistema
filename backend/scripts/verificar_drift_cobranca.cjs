// Introspecção somente leitura. Nunca aplica o SQL gerado.
const { spawnSync } = require('node:child_process');
const { writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
if (!url) throw new Error('Conexão ausente. Execute com railway run.');
const resultado = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'diff',
  '--from-url', url, '--to-schema-datamodel', resolve('backend/prisma/schema.prisma'), '--script'], { encoding: 'utf8', timeout: 60000 });
if (resultado.status !== 0) { console.error('Não foi possível concluir a comparação somente leitura.'); process.exitCode = 1; }
else {
  const arquivo = resolve('docs/diagnostico-drift-cobranca.sql');
  writeFileSync(arquivo, '-- Diagnóstico somente leitura. Não executar automaticamente.\n' + resultado.stdout, 'utf8');
  console.log('Comparação salva em docs/diagnostico-drift-cobranca.sql; nenhum comando aplicado.');
  console.log('CREATE TABLE:', (resultado.stdout.match(/CREATE TABLE/g) || []).length, 'ALTER TABLE:', (resultado.stdout.match(/ALTER TABLE/g) || []).length, 'DROP:', (resultado.stdout.match(/\bDROP\b/g) || []).length);
}
