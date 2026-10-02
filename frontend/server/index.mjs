import http from 'node:http';
import https from 'node:https';
import { createReadStream } from 'node:fs';
import { stat, realpath, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, extname, sep } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const defaultBackend = 'https://barbearia-backend-production-f72d.up.railway.app';
const hopHeaders = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);
const privateForwarding = new Set(['forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-real-ip', 'host']);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.lottie': 'application/zip' };

export function configuredBackend(value = process.env.API_PROXY_TARGET || defaultBackend) {
  const url = new URL(value);
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback && process.env.NODE_ENV !== 'production')) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Configure API_PROXY_TARGET com a origem HTTPS da API.');
  }
  return url;
}

export function securityHeaders(backend, voiceOrigin) {
  const websocket = new URL(backend); websocket.protocol = backend.protocol === 'https:' ? 'wss:' : 'ws:';
  const connect = ["'self'", websocket.origin];
  if (voiceOrigin) {
    const voice = new URL(voiceOrigin);
    if (voice.protocol !== 'wss:' || voice.username || voice.password || voice.pathname !== '/' || voice.search || voice.hash) throw new Error('Origem de voz inválida.');
    connect.push(voice.origin);
  }
  return {
    'Content-Security-Policy': ["default-src 'self'", "script-src 'self' 'wasm-unsafe-eval'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https:", "font-src 'self'", `connect-src ${connect.join(' ')}`, "worker-src 'self' blob:", "media-src 'self' blob:", "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'", "form-action 'self'"].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(), payment=()',
    'Strict-Transport-Security': 'max-age=15552000',
  };
}

function copyHeaders(headers, request = false) {
  const connectionTokens = String(headers.connection || '').split(',').map(s => s.trim().toLowerCase());
  return Object.fromEntries(Object.entries(headers).filter(([key]) => !hopHeaders.has(key) && !connectionTokens.includes(key) && !(request && (privateForwarding.has(key) || key.startsWith('x-forwarded-')))));
}

export function createFrontendServer({ dist = resolve(here, '../dist'), backend = configuredBackend(), voiceOrigin = process.env.CSP_VOICE_ORIGIN, maxBody = 12 * 1024 * 1024 } = {}) {
  const headers = securityHeaders(backend, voiceOrigin);
  const send = (res, status, message) => {
    if (res.headersSent) { res.destroy(); return; }
    res.writeHead(status, { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ erro: message }));
  };
  const server = http.createServer(async (req, res) => {
    for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
    const rawPath = (req.url || '/').split('?')[0];
    if (rawPath === '/api' || rawPath.startsWith('/api/')) {
      if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(req.method)) { send(res, 405, 'Operação indisponível.'); return; }
      const length = Number(req.headers['content-length']);
      if (Number.isFinite(length) && length > maxBody) { send(res, 413, 'Arquivo ou formulário muito grande.'); req.resume(); return; }
      // A fixed configured origin, never a browser-provided URL. Keep path+query as
      // path even if it contains //, encoded separators or an absolute URL.
      const path = req.url.slice(4) || '/';
      const outgoingHeaders = copyHeaders(req.headers, true);
      outgoingHeaders.host = backend.host;
      // Never trust a browser-supplied forwarding chain. The backend deliberately
      // sees this proxy's peer; account+global budgets remain shared in Postgres.
      outgoingHeaders['x-forwarded-proto'] = 'https';
      const upstream = (backend.protocol === 'https:' ? https : http).request({ hostname: backend.hostname, port: backend.port || undefined, protocol: backend.protocol, method: req.method, path: path.startsWith('/') ? path : `/${path}`, headers: outgoingHeaders }, upstreamRes => {
        if (res.destroyed) { upstreamRes.destroy(); return; }
        const responseHeaders = copyHeaders(upstreamRes.headers);
        delete responseHeaders['access-control-allow-origin'];
        delete responseHeaders['access-control-allow-credentials'];
        res.writeHead(upstreamRes.statusCode || 502, { ...responseHeaders, 'Cache-Control': 'no-store' });
        upstreamRes.on('error', () => res.destroy());
        upstreamRes.pipe(res);
      });
      let bytes = 0;
      req.on('data', chunk => { bytes += chunk.length; if (bytes > maxBody) { upstream.destroy(); send(res, 413, 'Arquivo ou formulário muito grande.'); } });
      req.on('aborted', () => upstream.destroy());
      upstream.setTimeout(65000, () => { upstream.destroy(); send(res, 504, 'A conexão demorou mais que o esperado. Tente novamente.'); });
      upstream.on('error', () => send(res, 502, 'Não foi possível conectar. Tente novamente em instantes.'));
      res.on('close', () => { if (!res.writableFinished) upstream.destroy(); });
      req.pipe(upstream);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { send(res, 405, 'Operação indisponível.'); return; }
    try {
      const pathname = decodeURIComponent(rawPath);
      if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').some(part => part === '..' || part.startsWith('.'))) { send(res, 404, 'Página não encontrada.'); return; }
      let filename = resolve(dist, `.${pathname}`);
      let info = await stat(filename).catch(() => null);
      if (!info?.isFile()) {
        if (extname(pathname) || pathname.startsWith('/assets/')) { send(res, 404, 'Arquivo não encontrado.'); return; }
        filename = resolve(dist, 'index.html'); info = await stat(filename);
      }
      const actual = await realpath(filename); const root = await realpath(dist);
      if (!actual.startsWith(root + sep)) { send(res, 404, 'Página não encontrada.'); return; }
      res.setHeader('Content-Type', types[extname(filename)] || 'application/octet-stream');
      res.setHeader('Content-Length', info.size);
      const hashedAsset = /\/assets\/[^/]+-[\w-]{8,}\.[\w.]+$/.test(pathname);
      res.setHeader('Cache-Control', hashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache');
      res.statusCode = 200;
      if (req.method === 'HEAD') res.end(); else createReadStream(filename).on('error', () => res.destroy()).pipe(res);
    } catch { send(res, 404, 'Página não encontrada.'); }
  });
  server.headersTimeout = 15000;
  server.requestTimeout = 70000;
  server.keepAliveTimeout = 5000;
  // Voice already connects directly to a short-lived-ticket WebSocket endpoint.
  server.on('upgrade', (_req, socket) => socket.destroy());
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createFrontendServer().listen(Number(process.env.PORT || 4173), '0.0.0.0');
}
