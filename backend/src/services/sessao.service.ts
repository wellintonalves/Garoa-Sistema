import { limitePonteSessao } from './ponteSessao.util';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authConfig } from '../config/auth';
import { ErroDeNegocio } from '../lib/erros';

export type Portal = 'admin' | 'cliente' | 'barbeiro' | 'tenant';
const idleSeconds = (portal: Portal) => (portal === 'admin' || portal === 'barbeiro' ? 120 : 30) * 60;
const ABSOLUTE_SECONDS = 12 * 60 * 60;
const ISSUER = 'valen-browser-session-v2';
const ambienteLocal = () => process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
const INVALIDA = 'Sua sessão expirou. Entre novamente para continuar.';
const camposSessao = { barbeiro: true, cliente: true, barbearia: { select: { ativo: true, slug: true } } } as const;
type Identidade = Awaited<ReturnType<typeof carregarIdentidade>>;

export function origensPermitidas(): string[] {
  return [
    'https://valenbarber.com.br',
    'https://barbearia-frontend-production-bb18.up.railway.app',
    ...(ambienteLocal() ? ['http://localhost:5173'] : []),
    ...(process.env.CORS_EXTRA_ORIGINS ?? '').split(',').map(o => o.trim()).filter(Boolean),
  ];
}

/** Cookies are only used through the same-origin frontend proxy. No third-party cookies. */
export function validarOrigemSessao(req: Request): void {
  if (req.get('X-Valen-Client') !== 'web') throw new ErroDeNegocio('Acesso não permitido.', 403);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !origensPermitidas().includes(req.get('Origin') ?? '')) {
    throw new ErroDeNegocio('Acesso não permitido.', 403);
  }
}

export function protegerEntradaSessao(req: Request, res: Response, next: NextFunction): void {
  try {
    res.setHeader('Cache-Control', 'no-store');
    validarEntradaLogin(req);
    if (!req.path.endsWith('/logout') && (typeof req.body?.email !== 'string' || !req.body.email.trim() || req.body.email.length > 254
      || typeof req.body?.senha !== 'string' || !req.body.senha || req.body.senha.length > 128)) {
      throw new ErroDeNegocio('Confira seu email e sua senha.', 400);
    }
    next();
  } catch (error) { next(error); }
}

function validarEntradaLogin(req: Request): void {
  if (!limitePonteSessao()) return validarOrigemSessao(req);
  if (!origensPermitidas().includes(req.get('Origin') ?? '')) throw new ErroDeNegocio('Acesso não permitido.', 403);
}

export function nomeCookie(portal: Portal): string {
  return `${ambienteLocal() ? '' : '__Host-'}valen_${portal}`;
}
function opcoesCookie() {
  return { httpOnly: true, secure: !ambienteLocal(), sameSite: 'lax' as const, path: '/' };
}
function segredo(portal: Portal) {
  return portal === 'cliente' ? authConfig.secretCliente : portal === 'barbeiro' ? authConfig.secretBarbeiro : authConfig.secret;
}
export async function carregarIdentidade(id: string) {
  const usuario = await prisma.usuario.findUnique({ where: { id }, include: camposSessao });
  if (!usuario) throw new ErroDeNegocio(INVALIDA, 401);
  // Fail closed if the additive migration has not been applied. Never silently issue v0 sessions.
  const version = (usuario as typeof usuario & { authVersion?: number }).authVersion;
  if (!Number.isSafeInteger(version) || Number(version) < 0) throw new ErroDeNegocio('Acesso temporariamente indisponível. Tente novamente em instantes.', 503);
  return { ...usuario, authVersion: version as number };
}
export function validarIdentidade(usuario: Identidade, portal: Portal): void {
  if (usuario.barbeariaId && !usuario.barbearia?.ativo) throw new ErroDeNegocio(INVALIDA, 401);
  if (portal === 'admin' && (usuario.papel !== 'ADMIN' || !usuario.barbeariaId || !usuario.barbearia?.ativo)) throw new ErroDeNegocio(INVALIDA, 401);
  if (portal === 'barbeiro' && (usuario.papel !== 'BARBEIRO' || !usuario.barbeiro?.ativo || !usuario.barbeariaId || usuario.barbeiro.barbeariaId !== usuario.barbeariaId)) throw new ErroDeNegocio(INVALIDA, 401);
  if ((portal === 'cliente' || portal === 'tenant') && (usuario.papel !== 'CLIENTE' || !usuario.cliente || !usuario.emailVerificado)) throw new ErroDeNegocio(INVALIDA, 401);
  if (portal === 'cliente' && usuario.barbeariaId !== null) throw new ErroDeNegocio(INVALIDA, 401);
  if (portal === 'tenant' && (!usuario.barbeariaId || usuario.cliente?.barbeariaId !== usuario.barbeariaId)) throw new ErroDeNegocio(INVALIDA, 401);
}
export function resumoSeguranca(usuario: Identidade, portal: Portal): string {
  return createHmac('sha256', segredo(portal)).update(JSON.stringify([
    usuario.id, usuario.senha, usuario.email, usuario.papel, usuario.barbeariaId, usuario.authVersion,
    usuario.barbeiro?.id ?? null, usuario.barbeiro?.ativo ?? null, usuario.barbeiro?.barbeariaId ?? null,
    usuario.cliente?.id ?? null, usuario.cliente?.barbeariaId ?? null,
  ])).digest('hex');
}
function gravarCookie(res: Response, usuario: Identidade, portal: Portal, inicio: number) {
  const agora = Math.floor(Date.now() / 1000);
  const exp = Math.min(agora + idleSeconds(portal), inicio + ABSOLUTE_SECONDS);
  const token = jwt.sign({ v: 2, portal, estado: resumoSeguranca(usuario, portal), inicio, exp }, segredo(portal), {
    algorithm: 'HS256', subject: usuario.id, issuer: ISSUER, audience: portal, jwtid: randomUUID(),
  });
  res.cookie(nomeCookie(portal), token, { ...opcoesCookie(), maxAge: (exp - agora) * 1000 });
  res.setHeader('Cache-Control', 'no-store');
}
export async function iniciarSessao(req: Request, res: Response, id: string, portal: Portal): Promise<string | undefined> {
  validarEntradaLogin(req);
  const usuario = await carregarIdentidade(id);
  validarIdentidade(usuario, portal);
  gravarCookie(res, usuario, portal, Math.floor(Date.now() / 1000));
  const fim = limitePonteSessao();
  // Only the old frontend receives this short transitional bearer. New frontend never does.
  if (fim && req.get('X-Valen-Client') !== 'web') {
    const payload = portal === 'barbeiro' ? dadosBarbeiro(usuario) : portal === 'cliente' ? dadosCliente(usuario) : dadosUsuario(usuario);
    return jwt.sign({ ...payload, v: 'bridge', estado: resumoSeguranca(usuario, portal), exp: Math.min(Math.floor(Date.now() / 1000) + 5 * 60, fim) }, segredo(portal),
      { algorithm: 'HS256', issuer: 'valen-bridge-v2', audience: portal, subject: usuario.id });
  }
}

function lerCookie(req: Request, portal: Portal): string {
  const values = (req.get('Cookie') ?? '').split(';').map(p => p.trim()).filter(p => p.startsWith(`${nomeCookie(portal)}=`));
  if (values.length !== 1) throw new ErroDeNegocio(INVALIDA, 401);
  return values[0].slice(nomeCookie(portal).length + 1);
}
async function autenticarPonte(req: Request, portal: Portal) {
  if (!limitePonteSessao()) throw new ErroDeNegocio(INVALIDA, 401);
  const origem = req.get('Origin');
  if (origem && !origensPermitidas().includes(origem)) throw new ErroDeNegocio('Acesso não permitido.', 403);
  const header = req.get('Authorization') ?? '';
  if (!/^Bearer [^ ]+$/.test(header)) throw new ErroDeNegocio(INVALIDA, 401);
  const token = header.slice(7);
  let claims: jwt.JwtPayload;
  try {
    const valor = jwt.verify(token, segredo(portal), { algorithms: ['HS256'] });
    if (typeof valor === 'string' || valor.v !== 'bridge') throw new Error();
    claims = valor;
    jwt.verify(token, segredo(portal), { algorithms: ['HS256'], issuer: 'valen-bridge-v2', audience: portal });
  } catch { throw new ErroDeNegocio(INVALIDA, 401); }
  const id = claims.sub;
  if (typeof id !== 'string' || typeof claims.exp !== 'number') throw new ErroDeNegocio(INVALIDA, 401);
  const usuario = await carregarIdentidade(id);
  validarIdentidade(usuario, portal);
  if (claims.estado !== resumoSeguranca(usuario, portal)) throw new ErroDeNegocio(INVALIDA, 401);
  return usuario;
}

export function portalAutenticacao(req: Request): Portal | null {
  const portal = req.get('X-Valen-Portal');
  if (portal === 'admin' || portal === 'barbeiro' || portal === 'tenant') return portal;
  if (!limitePonteSessao() || !req.get('Authorization')) return null;
  if (req.originalUrl.startsWith('/b/')) return 'tenant';
  const claims = jwt.decode((req.get('Authorization') ?? '').slice(7));
  return claims && typeof claims !== 'string' && claims.barbeiroId ? 'barbeiro' : 'admin';
}

export async function autenticarSessao(req: Request, res: Response, portal: Portal, renovar = true) {
  // The transition accepts explicit bearer transport, never a cookie-as-bearer.
  // Cookie requests always go through normal Origin/header protections below.
  if (req.get('Authorization')) {
    if (!limitePonteSessao()) throw new ErroDeNegocio(INVALIDA, 401);
    const usuario = await autenticarPonte(req, portal);
    res.setHeader('Cache-Control', 'no-store');
    return usuario;
  }
  validarOrigemSessao(req);
  // v1 bearer credentials are deliberately not migrated: they have no revocation state.
  let claims: jwt.JwtPayload;
  try {
    const decoded = jwt.verify(lerCookie(req, portal), segredo(portal), { algorithms: ['HS256'], issuer: ISSUER, audience: portal });
    if (typeof decoded === 'string') throw new Error();
    claims = decoded;
  } catch { throw new ErroDeNegocio(INVALIDA, 401); }
  const agora = Math.floor(Date.now() / 1000);
  if (claims.v !== 2 || claims.portal !== portal || typeof claims.sub !== 'string' || typeof claims.estado !== 'string'
    || !/^[a-f0-9]{64}$/.test(claims.estado) || typeof claims.inicio !== 'number' || !Number.isSafeInteger(claims.inicio)
    || claims.inicio > agora || agora >= claims.inicio + ABSOLUTE_SECONDS || typeof claims.iat !== 'number') throw new ErroDeNegocio(INVALIDA, 401);
  const usuario = await carregarIdentidade(claims.sub);
  validarIdentidade(usuario, portal);
  if (!timingSafeEqual(Buffer.from(claims.estado, 'hex'), Buffer.from(resumoSeguranca(usuario, portal), 'hex'))) throw new ErroDeNegocio(INVALIDA, 401);
  res.setHeader('Cache-Control', 'no-store');
  if (renovar && agora - claims.iat >= 5 * 60) gravarCookie(res, usuario, portal, claims.inicio);
  return usuario;
}
export function limparCookieSessao(res: Response, portal: Portal): void {
  res.clearCookie(nomeCookie(portal), opcoesCookie());
  res.setHeader('Cache-Control', 'no-store');
}
export function dadosUsuario(usuario: Identidade) {
  return { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel, barbeariaId: usuario.barbeariaId };
}
export function dadosCliente(usuario: Identidade) {
  return { clienteId: usuario.cliente!.id, usuarioId: usuario.id, nome: usuario.nome, email: usuario.email };
}
export function dadosBarbeiro(usuario: Identidade) {
  return { barbeiroId: usuario.barbeiro!.id, usuarioId: usuario.id, nome: usuario.nome, email: usuario.email, barbeariaId: usuario.barbeariaId! };
}
