import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFrontendServer, configuredBackend } from './index.mjs';
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });

test('static headers, SPA refresh, immutable assets, traversal and safe fixed proxy', async () => {
  const dist = await mkdtemp(join(tmpdir(), 'valen-frontend-test-'));
  await mkdir(join(dist, 'assets'));
  await writeFile(join(dist, 'index.html'), '<!doctype html><title>Teste</title>');
  await writeFile(join(dist, 'assets/app-12345678.js'), 'export{};');
  let seen;
  const api = http.createServer((req, res) => {
    seen = { url: req.url, headers: req.headers };
    res.setHeader('Set-Cookie', ['valen_admin=synthetic; HttpOnly; SameSite=Lax; Path=/', 'valen_cliente=synthetic2; HttpOnly; Path=/']);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
  });
  const backend = await listen(api);
  const server = createFrontendServer({ dist, backend: new URL(backend), maxBody: 32 });
  const url = await listen(server);
  try {
    for (const path of ['/', '/admin/login', '/cliente/home']) {
      const response = await fetch(url + path);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
      assert.doesNotMatch(response.headers.get('content-security-policy'), /script-src[^;]*'unsafe-inline'/);
      assert.equal(response.headers.get('x-frame-options'), 'DENY');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('cache-control'), 'no-cache');
      assert.ok(response.headers.get('strict-transport-security'));
      await response.text();
    }
    const head = await fetch(url + '/admin/login', { method: 'HEAD' });
    assert.equal(head.status, 200); assert.equal(await head.text(), '');
    const asset = await fetch(url + '/assets/app-12345678.js');
    assert.match(asset.headers.get('cache-control'), /immutable/); await asset.text();
    for (const path of ['/.env', '/%2e%2e%2f.env', '/assets/missing.js']) assert.equal((await fetch(url + path)).status, 404);
    const proxy = await fetch(url + '/api/session?private=synthetic', { headers: { Cookie: 'valen_admin=synthetic', Origin: 'https://valenbarber.com.br', 'X-Valen-Client': 'web', 'X-Forwarded-For': 'evil', 'X-Forwarded-Host': 'evil.test' } });
    assert.equal(proxy.status, 200); assert.equal(seen.url, '/session?private=synthetic');
    assert.equal(seen.headers.origin, 'https://valenbarber.com.br');
    assert.equal(seen.headers.cookie, 'valen_admin=synthetic');
    assert.equal(seen.headers['x-forwarded-for'], undefined);
    assert.equal(seen.headers['x-forwarded-host'], undefined);
    assert.equal(proxy.headers.getSetCookie().length, 2);
    assert.equal(proxy.headers.get('cache-control'), 'no-store');
    await proxy.text();
    await fetch(url + '/api//example.invalid/path');
    assert.equal(seen.url, '//example.invalid/path'); assert.equal(seen.headers.host, new URL(backend).host);
    const large = await fetch(url + '/api/upload', { method: 'POST', body: 'x'.repeat(33) });
    assert.equal(large.status, 413);
    assert.throws(() => configuredBackend('https://name:secret@example.test'), /origem/);
    assert.throws(() => configuredBackend('https://example.test/path'), /origem/);
  } finally { await close(server); await close(api); await rm(dist, { recursive: true, force: true }); }
});
