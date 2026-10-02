import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deepmerge } from 'deepmerge-ts';
import { loadConfigFromFile } from '@prisma/config';
const lock = JSON.parse(await readFile(new URL('../../package-lock.json', import.meta.url), 'utf8'));
const resolved = Object.entries(lock.packages).filter(([path]) => path.endsWith('/deepmerge-ts'));
assert.ok(resolved.length > 0);
assert.ok(resolved.every(([, pkg]) => Number(pkg.version.split('.')[0]) >= 8));
assert.deepEqual(deepmerge({ migrations: { path: 'a' }, values: [1] }, { migrations: { seed: 'local' }, values: [2] }), { migrations: { path: 'a', seed: 'local' }, values: [1, 2] });
const first = {}; first.self = first;
const second = {}; second.self = second;
const combined = deepmerge(first, second);
assert.equal(combined.self, combined);
const dir = await mkdtemp(join(tmpdir(), 'valen-config-test-'));
try {
  await writeFile(join(dir, 'prisma.config.js'), `module.exports = { schema: 'schema.prisma', migrations: { path: 'migrations', seed: 'echo synthetic' } };\n`);
  const result = await loadConfigFromFile({ configRoot: dir });
  assert.equal(result.error, undefined);
  assert.equal(result.config.schema, join(dir, 'schema.prisma'));
  assert.equal(result.config.migrations.path, join(dir, 'migrations'));
  assert.equal(result.config.migrations.seed, 'echo synthetic');
  console.log('PASS dependency: patched graph, recursive objects, ordinary merge, actual Prisma config loader.');
} finally { await rm(dir, { recursive: true, force: true }); }
