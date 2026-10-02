import assert from 'node:assert/strict';
import http from 'node:http';
import { once, EventEmitter } from 'node:events';
import express, { type Request, type Response } from 'express';
import sharp from 'sharp';
import type { BucketUpload, AtorUpload } from '../src/services/supabase.service';
import type { AuthRequest } from '../src/types';

// Somente fixtures em memória; nunca abre conexão de banco ou chama Supabase.
process.env.JWT_SECRET = 'segredo-sintetico-upload-admin-123';
process.env.JWT_SECRET_CLIENTE = 'segredo-sintetico-upload-cliente-123';
process.env.JWT_SECRET_BARBEIRO = 'segredo-sintetico-upload-barbeiro-123';
let emTransacao = false;
let lockDisponivel = true;
let papelPermitido = true;
let logoAtual: string | null = 'https://legado.example.test/logo.jpg';
let fotoAtual: string | null = 'https://legado.example.test/foto.jpg';
let falharBanco = false;
const fake = {
  $queryRaw: async () => [{ adquirido: lockDisponivel }],
  barbearia: {
    findUnique: async () => ({ id: 'tenant-a', logo: logoAtual }),
    findFirst: async ({ where }: { where: { id: string } }) => where.id === 'tenant-a' ? { id: where.id, logo: logoAtual } : null,
    updateMany: async ({ where, data }: { where: { logo: string | null }; data: { logo: string } }) => {
      if (falharBanco) throw new Error('falha-sintetica');
      if (where.logo !== logoAtual) return { count: 0 }; logoAtual = data.logo; return { count: 1 };
    },
  },
  usuario: { findFirst: async ({ where }: { where: { id: string; barbeariaId: string; papel: string } }) =>
    papelPermitido && where.id === 'admin-a' && where.barbeariaId === 'tenant-a' && where.papel === 'ADMIN' ? { id: where.id } : null },
  barbeiro: {
    findUnique: async () => ({ id: 'barbeiro-a', foto: fotoAtual, usuarioId: 'usuario-barbeiro-a', barbeariaId: 'tenant-a' }),
    findFirst: async ({ where }: { where: { id: string; usuarioId?: string; barbeariaId: string } }) =>
      where.id === 'barbeiro-a' && (!where.usuarioId || where.usuarioId === 'usuario-barbeiro-a') && where.barbeariaId === 'tenant-a' ? { id: where.id, foto: fotoAtual } : null,
    updateMany: async ({ where, data }: { where: { foto: string | null }; data: { foto: string } }) => {
      if (falharBanco) throw new Error('falha-sintetica');
      if (where.foto !== fotoAtual) return { count: 0 }; fotoAtual = data.foto; return { count: 1 };
    },
  },
  $transaction: async <T>(fn: (tx: typeof fake) => Promise<T>) => {
    const anterior = { logoAtual, fotoAtual }; emTransacao = true;
    try { return await fn(fake); } catch (error) { ({ logoAtual, fotoAtual } = anterior); throw error; } finally { emTransacao = false; }
  },
};
(globalThis as typeof globalThis & { prisma?: unknown }).prisma = { $extends: () => fake };

function memoriaBucket() {
  const objetos = new Map<string, Buffer>();
  const operacoes: string[] = [];
  let falharLista = false;
  let metadadosInvalidos = false;
  let exigirTransacao = false;
  let falharImagem = false;
  let falharRemocao = false;
  let negarSilencioso = false;
  const tardias: (() => void)[] = [];
  const bucket: BucketUpload = {
    list: async (prefixo, { limit, offset }) => {
      if (exigirTransacao) assert.equal(emTransacao, true);
      operacoes.push(`list:${prefixo}:${offset}`);
      return { error: falharLista ? new Error('segredo-do-provedor') : null,
        data: [...objetos.entries()].filter(([p]) => p.startsWith(prefixo + '/')).sort(([a], [b]) => a.localeCompare(b)).slice(offset, offset + limit)
          .map(([p, bytes]) => ({ name: p.slice(prefixo.length + 1), id: p, metadata: metadadosInvalidos ? null : { size: bytes.length } })) };
    },
    upload: async (path, bytes, options) => {
      if (exigirTransacao) assert.equal(emTransacao, true);
      assert.equal(options.upsert, false);
      assert.equal(options.contentType, 'image/webp');
      assert.match(path, /^imagens-v2\/tenant-[ab]\/[a-z0-9-]+\/(pendente\.webp|arquivos\/[a-f0-9-]{36}\.webp)$/);
      operacoes.push(`upload:${path}`);
      if (objetos.has(path)) return { error: new Error('conflito') };
      if (falharImagem && path.includes('/arquivos/')) { tardias.push(() => { if (!objetos.has(path)) objetos.set(path, Buffer.from(bytes)); }); return { error: new Error('resultado-incerto') }; }
      objetos.set(path, Buffer.from(bytes));
      return { error: null };
    },
    remove: async paths => {
      if (exigirTransacao) assert.equal(emTransacao, true);
      paths.forEach(p => { operacoes.push(`remove:${p}`); });
      if (falharRemocao) { tardias.push(() => { paths.forEach(p => objetos.delete(p)); }); return { data: null, error: new Error('exclusao-incerta') }; }
      if (negarSilencioso) return { data: [], error: null };
      const data = paths.filter(p => objetos.has(p)).map(name => ({ name }));
      paths.forEach(p => objetos.delete(p)); return { data, error: null };
    },
    getPublicUrl: path => ({ data: { publicUrl: `https://imagens.example.test/${path}` } }),
  };
  return { bucket, objetos, operacoes, falharLista: () => { falharLista = true; }, invalidarMetadados: () => { metadadosInvalidos = true; }, exigirTransacao: () => { exigirTransacao = true; }, falharImagem: () => { falharImagem = true; }, falharRemocao: () => { falharRemocao = true; }, negarSilencioso: () => { negarSilencioso = true; }, concluirTardias: () => { tardias.splice(0).forEach(f => f()); } };
}

const boundary = 'fronteira-sintetica';
function multipart(partes: { nome: string; bytes: Buffer; arquivo?: string; tipo?: string }[]): Buffer {
  return Buffer.concat([...partes.flatMap(p => [Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${p.nome}"${p.arquivo === undefined ? '' : `; filename="${p.arquivo}"`}\r\n${p.tipo ? `Content-Type: ${p.tipo}\r\n` : ''}\r\n`), p.bytes, Buffer.from('\r\n')]), Buffer.from(`--${boundary}--\r\n`)]);
}

async function main() {
  const { normalizarImagem, MAX_ARQUIVO_IMAGEM, MAX_IMAGEM_ARMAZENADA } = await import('../src/services/imagemUpload.service');
  const { SupabaseService, substituirImagemLimitada, MAX_IMAGENS_POR_RECURSO } = await import('../src/services/supabase.service');
  const { receberImagem, uploadImagem, MAX_CORPO_UPLOAD } = await import('../src/middlewares/upload.middleware');
  const { roleMiddleware } = await import('../src/middlewares/role.middleware');
  const imagem = sharp({ create: { width: 1400, height: 700, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 0.4 } } });
  const png = await imagem.clone().png().toBuffer();
  const jpg = await imagem.clone().jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const webp = await imagem.clone().webp().toBuffer();
  for (const [entrada, tipo] of [[png, 'image/png'], [jpg, 'image/jpeg'], [webp, 'image/webp']] as const) {
    const saida = await normalizarImagem(entrada, tipo);
    const dados = await sharp(saida).metadata();
    assert.equal(dados.format, 'webp');
    assert.ok(dados.width! <= 1024 && dados.height! <= 1024);
    assert.equal(dados.exif, undefined);
    assert.ok(saida.length <= MAX_IMAGEM_ARMAZENADA);
  }
  const orientada = await sharp(await normalizarImagem(jpg, 'image/jpeg')).metadata();
  assert.ok(orientada.height! > orientada.width!, 'orientação EXIF aplicada antes de remover metadados');
  assert.equal((await sharp(await normalizarImagem(png, 'image/png')).metadata()).hasAlpha, true);
  for (const [entrada, tipo, status] of [
    [Buffer.from('<script>alert(1)</script>'), 'image/png', 415],
    [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/svg+xml', 415],
    [png, 'image/jpeg', 415], [png.subarray(0, 40), 'image/png', 415],
    [Buffer.alloc(MAX_ARQUIVO_IMAGEM + 1), 'image/png', 413],
    [Buffer.from('GIF89a'), 'image/gif', 415],
  ] as const) await assert.rejects(normalizarImagem(entrada, tipo), { status });
  const animada = await sharp(Buffer.concat([Buffer.alloc(12, 0), Buffer.alloc(12, 200)]), { raw: { width: 2, height: 4, channels: 3, pageHeight: 2 } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
  await assert.rejects(normalizarImagem(animada, 'image/webp'), { status: 415 });
  const pixelsDemais = await sharp({ create: { width: 4001, height: 4001, channels: 3, background: 'red' } }).png().toBuffer();
  await assert.rejects(normalizarImagem(pixelsDemais, 'image/png'), { status: 415 });
  const larga = await sharp({ create: { width: 8193, height: 1, channels: 3, background: 'red' } }).png().toBuffer();
  await assert.rejects(normalizarImagem(larga, 'image/png'), { status: 415 });
  const poliglota = Buffer.concat([jpg, Buffer.from('<script>payload-sintetico</script>')]);
  const limpa = await normalizarImagem(poliglota, 'image/jpeg');
  assert.ok(!limpa.includes(Buffer.from('payload-sintetico')));
  console.log('PASS: formatos reais, assinatura/MIME, decode, truncamento, pixels, orientação, alfa e re-encode sem payload/metadados');

  const loja = memoriaBucket();
  const legado = Buffer.from('foto-legada-preservada'); loja.objetos.set('logo-antigo.jpg', legado);
  let atual: string | null = 'https://legado.example.test/foto.jpg';
  const salvar = async (url: string) => { atual = url; };
  for (let i = 0; i < 256; i++) {
    await substituirImagemLimitada(loja.bucket, 'tenant-a', 'barbeiro-a', atual, webp, salvar);
    assert.ok(loja.objetos.size <= 3, 'substituições sustentáveis mantêm atual + anterior, além de legado');
  }
  const urlAntesAlias = atual!;
  atual = urlAntesAlias.replace('imagens.example.test', 'cdn.example.test') + '?v=cache';
  await substituirImagemLimitada(loja.bucket, 'tenant-a', 'barbeiro-a', atual, webp, salvar);
  assert.ok(loja.objetos.has(urlAntesAlias.replace('https://imagens.example.test/', '')), 'alias/consulta na URL não permite excluir a foto atual');
  assert.deepEqual(loja.objetos.get('logo-antigo.jpg'), legado);
  const imagensAntes = [...loja.objetos.keys()];
  await substituirImagemLimitada(loja.bucket, 'tenant-b', 'logo', null, webp, async () => {});
  for (const p of imagensAntes) assert.ok(loja.objetos.has(p), 'outra unidade não pode remover arquivos');
  const paginada = memoriaBucket();
  for (let i = 0; i < 10; i++) paginada.objetos.set(`imagens-v2/tenant-a/logo/arquivos/00000000-0000-4000-8000-${String(i).padStart(12, '0')}.webp`, webp);
  await substituirImagemLimitada(paginada.bucket, 'tenant-a', 'logo', null, webp, async () => {});
  assert.ok(paginada.operacoes.some(o => o.endsWith(':8')));
  assert.equal(paginada.objetos.size, 1, 'arquivos sem referência são reciclados');
  const falha = memoriaBucket(); falha.falharLista();
  await assert.rejects(substituirImagemLimitada(falha.bucket, 'tenant-a', 'logo', null, webp, async () => {}), { status: 503 });
  assert.equal(falha.objetos.size, 1, 'reserva persiste em falha de inventário');
  const excesso = memoriaBucket();
  for (let i = 0; i <= MAX_IMAGENS_POR_RECURSO; i++) excesso.objetos.set(`imagens-v2/tenant-a/logo/arquivos/00000000-0000-4000-8000-${String(i).padStart(12, '0')}.webp`, webp);
  await assert.rejects(substituirImagemLimitada(excesso.bucket, 'tenant-a', 'logo', null, webp, async () => {}), { status: 409 });
  assert.ok(!excesso.operacoes.some(o => o.startsWith('remove:')));
  const inventarioInvalido = memoriaBucket();
  inventarioInvalido.objetos.set('imagens-v2/tenant-a/logo/arquivos/00000000-0000-4000-8000-000000000000.webp', webp); inventarioInvalido.invalidarMetadados();
  await assert.rejects(substituirImagemLimitada(inventarioInvalido.bucket, 'tenant-a', 'logo', null, webp, async () => {}), { status: 503 });
  await assert.rejects(substituirImagemLimitada(loja.bucket, '../tenant-b', 'logo', null, webp, async () => {}), { status: 503 });
  const tardia = memoriaBucket(); let referencia: string | null = null;
  await substituirImagemLimitada(tardia.bucket, 'tenant-a', 'logo', referencia, webp, async url => { referencia = url; });
  const preservada = referencia;
  const bytesPreservados = [...tardia.objetos.values()][0];
  tardia.falharImagem();
  await assert.rejects(substituirImagemLimitada(tardia.bucket, 'tenant-a', 'logo', referencia, png, async url => { referencia = url; }), { status: 503 });
  for (let i = 0; i < 10; i++) await assert.rejects(substituirImagemLimitada(tardia.bucket, 'tenant-a', 'logo', referencia, webp, async () => {}), { status: 409 });
  tardia.concluirTardias();
  assert.equal(referencia, preservada); assert.equal(tardia.objetos.size, 3, 'reserva bloqueia acúmulo de envios tardios');
  assert.ok([...tardia.objetos.values()].some(b => b.equals(bytesPreservados)));
  const exclusaoTardia = memoriaBucket(); let referenciaExclusao: string | null = null;
  for (let i = 0; i < 2; i++) await substituirImagemLimitada(exclusaoTardia.bucket, 'tenant-a', 'logo', referenciaExclusao, webp, async url => { referenciaExclusao = url; });
  const atualAntes = referenciaExclusao;
  exclusaoTardia.falharRemocao();
  await assert.rejects(substituirImagemLimitada(exclusaoTardia.bucket, 'tenant-a', 'logo', referenciaExclusao, webp, async () => {}), { status: 503 });
  await assert.rejects(substituirImagemLimitada(exclusaoTardia.bucket, 'tenant-a', 'logo', referenciaExclusao, webp, async () => {}), { status: 409 });
  exclusaoTardia.concluirTardias();
  assert.ok([...exclusaoTardia.objetos.keys()].some(p => `https://imagens.example.test/${p}` === atualAntes), 'exclusão tardia não toca foto atual');
  console.log('PASS: 256 substituições, reciclagem sem legado/atual, paginação, inventário completo, reserva durável e resultados tardios sem acúmulo');

  const controle = memoriaBucket(); controle.exigirTransacao();
  const adaptador = SupabaseService as unknown as { getClient: () => { storage: { from: () => BucketUpload } } };
  const getClient = adaptador.getClient;
  adaptador.getClient = () => ({ storage: { from: () => controle.bucket } });
  const admin: AtorUpload = { barbeariaId: 'tenant-a', usuarioId: 'admin-a', papel: 'ADMIN' };
  await SupabaseService.uploadImage('barbearias', admin, png, 'image/png');
  await SupabaseService.uploadImage('barbeiros', { barbeariaId: 'tenant-a', usuarioId: 'usuario-barbeiro-a', barbeiroId: 'barbeiro-a', papel: 'BARBEIRO' }, png, 'image/png');
  assert.match(logoAtual!, /imagens-v2/); assert.match(fotoAtual!, /barbeiro-a/);
  const escritasAntes = controle.objetos.size;
  await assert.rejects(SupabaseService.uploadImage('barbearias', { ...admin, papel: 'BARBEIRO', barbeiroId: 'barbeiro-a' }, png, 'image/png'), { status: 403 });
  await assert.rejects(SupabaseService.uploadImage('barbeiros', { ...admin, barbeariaId: 'tenant-b' }, png, 'image/png', 'barbeiro-a'), { status: 403 });
  await assert.rejects(SupabaseService.uploadImage('barbeiros', admin, png, 'image/png', 'barbeiro-de-outro-tenant'), { status: 403 });
  await assert.rejects(SupabaseService.uploadImage('barbeiros', admin, png, 'image/png'), { status: 403 });
  papelPermitido = false;
  await assert.rejects(SupabaseService.uploadImage('barbearias', admin, png, 'image/png'), { status: 403 });
  papelPermitido = true; lockDisponivel = false;
  await assert.rejects(SupabaseService.uploadImage('barbearias', admin, png, 'image/png'), { status: 429 });
  lockDisponivel = true; assert.equal(controle.objetos.size, escritasAntes);
  const fotoAntesFalha = fotoAtual; falharBanco = true;
  await assert.rejects(SupabaseService.uploadImage('barbeiros', admin, png, 'image/png', 'barbeiro-a'), { status: 503 });
  falharBanco = false; assert.equal(fotoAtual, fotoAntesFalha);
  assert.ok([...controle.objetos.keys()].some(p => `https://imagens.example.test/${p}` === fotoAntesFalha));
  const semDelete = memoriaBucket(); semDelete.falharRemocao();
  adaptador.getClient = () => ({ storage: { from: () => semDelete.bucket } });
  const logoAntesNegacao = logoAtual; logoAtual = 'https://legado.example.test/logo-sem-delete.jpg';
  await assert.rejects(SupabaseService.uploadImage('barbearias', admin, png, 'image/png'), { status: 503 });
  assert.equal(logoAtual, 'https://legado.example.test/logo-sem-delete.jpg');
  assert.equal(semDelete.objetos.size, 2, 'sem DELETE mantém reserva e arquivo não referenciado, sem alterar foto atual');
  await assert.rejects(SupabaseService.uploadImage('barbearias', admin, png, 'image/png'), { status: 409 });
  assert.equal(semDelete.objetos.size, 2, 'negação do provedor não permite acúmulo em novas tentativas');
  const semDeleteSilencioso = memoriaBucket(); semDeleteSilencioso.negarSilencioso();
  adaptador.getClient = () => ({ storage: { from: () => semDeleteSilencioso.bucket } });
  await assert.rejects(SupabaseService.uploadImage('barbearias', admin, png, 'image/png'), { status: 503 });
  assert.equal(logoAtual, 'https://legado.example.test/logo-sem-delete.jpg');
  logoAtual = logoAntesNegacao;
  adaptador.getClient = getClient;
  const configAnterior = { url: process.env.SUPABASE_URL, anon: process.env.SUPABASE_ANON_KEY, service: process.env.SUPABASE_SERVICE_ROLE_KEY };
  process.env.SUPABASE_URL = 'https://supabase.example.test'; process.env.SUPABASE_ANON_KEY = 'chave-anon-sintetica'; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.ok(adaptador.getClient().storage, 'configuração existente com chave anon é mantida, sem chamadas remotas');
  for (const [key, value] of [['SUPABASE_URL', configAnterior.url], ['SUPABASE_ANON_KEY', configAnterior.anon], ['SUPABASE_SERVICE_ROLE_KEY', configAnterior.service]] as const) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  const { validarReferenciaImagemRecebida } = await import('../src/services/referenciaImagem.service');
  validarReferenciaImagemRecebida('data:image/svg+xml;base64,legado', 'data:image/svg+xml;base64,legado');
  validarReferenciaImagemRecebida(undefined, fotoAtual); validarReferenciaImagemRecebida('', fotoAtual);
  for (const recebida of ['data:image/svg+xml;base64,novo', 'https://outro.example.test/imagem', { foto: 'x' }]) {
    assert.throws(() => validarReferenciaImagemRecebida(recebida, fotoAtual), { status: 400 });
  }
  const { BarbeiroService } = await import('../src/services/barbeiro.service');
  const { BarbeiroAppService } = await import('../src/services/barbeiroApp.service');
  const { ConfiguracaoController } = await import('../src/controllers/configuracao.controller');
  const fotoAlheia = 'https://imagens.example.test/imagens-v2/tenant-b/barbeiro-b/arquivos/00000000-0000-4000-8000-000000000000.webp';
  await assert.rejects(BarbeiroService.criar({ nome: 'Sintético', email: 'novo@example.test', senha: 'senha-sintetica', foto: fotoAlheia }, 'tenant-a'), { status: 400 });
  await assert.rejects(BarbeiroService.atualizar('barbeiro-a', { foto: fotoAlheia }), { status: 400 });
  await assert.rejects(BarbeiroAppService.atualizarPerfil('barbeiro-a', { foto: fotoAlheia }), { status: 400 });
  let statusLogo = 0; let mensagemLogo = '';
  const respostaLogo = { status: (status: number) => { statusLogo = status; return respostaLogo; }, json: (dados: { erro: string }) => { mensagemLogo = dados.erro; } } as unknown as Response;
  await ConfiguracaoController.updateMinhaBarbearia({ usuario: { id: 'admin-a', papel: 'ADMIN', barbeariaId: 'tenant-a' }, body: { logo: fotoAlheia } } as AuthRequest, respostaLogo);
  assert.equal(statusLogo, 400); assert.equal(mensagemLogo, 'Use o envio de foto para alterar a imagem.');
  console.log('PASS: autorização e recurso revalidados, persistência sob lock, rollback mantém foto, atribuições diretas bloqueadas e legado inalterado');

  const app = express();
  const observador = new EventEmitter();
  app.use((req, res, next) => {
    if (req.path === '/concorrente') {
      res.once('close', () => observador.emit(`fechou:${req.headers['x-ator']}`));
      setImmediate(() => observador.emit(`abriu:${req.headers['x-ator']}`));
    }
    next();
  });
  let persistencias = 0;
  const ok = (req: Request, res: Response) => { persistencias++; res.json({ bytes: req.file?.size, campos: Object.keys(req.body ?? {}).length }); };
  app.use((req: AuthRequest, _res, next) => { if (req.headers['x-ator']) req.usuario = { id: String(req.headers['x-ator']), nome: 'Sintético', email: 'fixture@example.test', papel: req.headers['x-papel'] === 'BARBEIRO' ? 'BARBEIRO' : 'ADMIN', barbeariaId: String(req.headers['x-tenant'] ?? 'tenant-a') }; next(); });
  app.post('/parser', receberImagem, ok);
  app.post('/concorrente', ...uploadImagem, ok);
  app.post('/limitado', ...uploadImagem, ok);
  app.post('/outro-alias', ...uploadImagem, ok);
  app.post('/admin', roleMiddleware('ADMIN'), ...uploadImagem, ok);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const endereco = server.address(); assert.ok(endereco && typeof endereco !== 'string');
  const porta = endereco.port;
  const enviar = (body: Buffer, path = '/parser', headers: Record<string, string> = {}, chunked = false) => new Promise<{ status: number; texto: string }>((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: porta, path, method: 'POST', headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`, ...(chunked ? {} : { 'Content-Length': String(body.length) }), ...headers,
    } }, res => { let texto = ''; res.setEncoding('utf8'); res.on('data', c => { texto += c; }); res.on('end', () => resolve({ status: res.statusCode!, texto })); });
    req.on('error', reject);
    if (chunked) { for (let i = 0; i < body.length; i += 16 * 1024) req.write(body.subarray(i, i + 16 * 1024)); req.end(); } else req.end(body);
  });
  const parte = { nome: 'file', arquivo: 'nome-nao-confiavel.html', tipo: 'image/png', bytes: png };
  const valido = multipart([parte]);
  try {
    const abrirParcial = async (ator: string) => {
      const aberta = once(observador, `abriu:${ator}`);
      const req = http.request({ host: '127.0.0.1', port: porta, path: '/concorrente', method: 'POST', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'x-ator': ator, 'x-tenant': 'tenant-concorrente' } });
      req.on('error', () => {}); req.write(valido.subarray(0, 60)); await aberta; return req;
    };
    const primeira = await abrirParcial('simultanea-a'); const segunda = await abrirParcial('simultanea-b');
    assert.equal((await enviar(valido, '/concorrente', { 'x-ator': 'simultanea-c', 'x-tenant': 'tenant-concorrente' })).status, 429);
    const fechadaA = once(observador, 'fechou:simultanea-a'); const fechadaB = once(observador, 'fechou:simultanea-b');
    primeira.destroy(); segunda.destroy(); await Promise.all([fechadaA, fechadaB]);
    assert.equal((await enviar(valido, '/concorrente', { 'x-ator': 'simultanea-d', 'x-tenant': 'tenant-concorrente' })).status, 200);
    assert.equal((await enviar(valido)).status, 200);
    assert.equal((await enviar(valido, '/parser', {}, true)).status, 200);
    assert.equal((await enviar(multipart([]))).status, 400);
    assert.equal((await enviar(multipart([{ nome: 'campo', bytes: Buffer.from('x') }, parte]))).status, 413);
    assert.equal((await enviar(multipart([parte, { nome: 'campo', bytes: Buffer.alloc(1000) }]))).status, 413);
    assert.equal((await enviar(multipart([parte, parte]))).status, 413);
    assert.equal((await enviar(multipart([{ ...parte, nome: 'x'.repeat(33) }]))).status, 413);
    assert.equal((await enviar(multipart([{ ...parte, tipo: 'text/html' }]))).status, 415);
    assert.equal((await enviar(multipart([{ ...parte, bytes: Buffer.alloc(MAX_ARQUIVO_IMAGEM + 1) }]))).status, 413);
    assert.equal((await enviar(Buffer.concat([Buffer.alloc(MAX_CORPO_UPLOAD + 1, 32), valido]), '/parser', {}, true)).status, 413);
    assert.equal((await enviar(Buffer.concat([valido, Buffer.alloc(MAX_CORPO_UPLOAD + 1, 32)]), '/parser', {}, true)).status, 413);
    assert.equal((await enviar(valido.subarray(0, valido.length - 10))).status, 415);
    const antes = persistencias;
    assert.equal((await enviar(valido, '/limitado')).status, 401);
    assert.equal((await enviar(valido, '/admin', { 'x-ator': 'barbeiro', 'x-papel': 'BARBEIRO' })).status, 403);
    assert.equal(persistencias, antes);
    for (let i = 0; i < 10; i++) assert.equal((await enviar(valido, i % 2 ? '/outro-alias' : '/limitado', { 'x-ator': 'ator-limitado' })).status, 200);
    assert.equal((await enviar(valido, '/outro-alias', { 'x-ator': 'ator-limitado' })).status, 429);
    for (let i = 0; i < 20; i++) assert.equal((await enviar(valido, '/limitado', { 'x-ator': `ator-${i}` })).status, 200);
    assert.equal((await enviar(valido, '/limitado', { 'x-ator': 'outro-ator' })).status, 429);
    assert.equal((await enviar(valido, '/limitado', { 'x-ator': 'outro-ator', 'x-tenant': 'tenant-b' })).status, 200);
    console.log('PASS: HTTP multipart, campos/partes/arquivos/bytes, chunked, preâmbulo/epílogo, falhas controladas, papel e quotas por ator/tenant compartilhadas');
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
