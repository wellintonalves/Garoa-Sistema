import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { AuthRequest, BarbeiroAuthRequest } from '../types';
import { MAX_ARQUIVO_IMAGEM } from '../services/imagemUpload.service';

export const MAX_CORPO_UPLOAD = MAX_ARQUIVO_IMAGEM + 16 * 1024;
const DURACAO_UPLOAD_MS = 30_000;

function identidade(req: Request): { tenant: string; ator: string } | null {
  const usuario = (req as AuthRequest).usuario;
  const barbeiro = (req as BarbeiroAuthRequest).barbeiro;
  const tenant = usuario?.barbeariaId ?? barbeiro?.barbeariaId;
  const ator = usuario?.id ?? barbeiro?.usuarioId;
  return tenant && ator ? { tenant, ator } : null;
}

const mensagemLimite = { erro: 'Muitas fotos enviadas. Aguarde alguns minutos e tente novamente.' };
const porAtor = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, keyGenerator: req => {
  const id = identidade(req)!;
  return `${id.tenant}:${id.ator}`;
}, standardHeaders: true, legacyHeaders: false, message: mensagemLimite });
const porTenant = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30,
  keyGenerator: req => identidade(req)!.tenant,
  standardHeaders: true, legacyHeaders: false, message: mensagemLimite });

const ativosPorTenant = new Map<string, number>();
let ativos = 0;

function reservarUpload(req: Request, res: Response, next: NextFunction): void {
  const id = identidade(req);
  if (!id) { res.status(401).json({ erro: 'Sua sessão expirou. Entre novamente para continuar.' }); return; }
  const quantidade = ativosPorTenant.get(id.tenant) ?? 0;
  if (ativos >= 8 || quantidade >= 2) {
    res.setHeader('Retry-After', '10');
    res.status(429).json({ erro: 'Já há fotos sendo enviadas. Aguarde e tente novamente.' }); return;
  }
  ativos++;
  ativosPorTenant.set(id.tenant, quantidade + 1);
  let liberado = false;
  const liberar = () => {
    if (liberado) return;
    liberado = true;
    ativos--;
    const restante = (ativosPorTenant.get(id.tenant) ?? 1) - 1;
    if (restante) ativosPorTenant.set(id.tenant, restante); else ativosPorTenant.delete(id.tenant);
  };
  res.once('finish', liberar);
  res.once('close', liberar);
  next();
}

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ARQUIVO_IMAGEM, files: 1, fields: 0, parts: 1, fieldNameSize: 32, fieldSize: 0, headerPairs: 16 },
  fileFilter: (_req, file, done) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      done(new Error('FORMATO_IMAGEM_INVALIDO')); return;
    }
    done(null, true);
  },
}).single('file');

/** Limita também preâmbulo, epílogo e transferências chunked, fora dos limites do Multer. */
export function receberImagem(req: Request, res: Response, next: NextFunction): void {
  if (!req.is('multipart/form-data')) {
    res.status(415).json({ erro: 'Envie uma foto JPG, PNG ou WebP.' }); return;
  }
  let encerrado = false;
  let bytes = 0;
  const limpar = () => { clearTimeout(prazo); req.off('data', contar); req.off('aborted', cancelar); };
  const recusar = (status: number, mensagem: string) => {
    if (encerrado) return;
    encerrado = true;
    limpar();
    req.unpipe();
    // Fecha após a resposta: não deixa um corpo rejeitado/sem fim ocupar o servidor.
    res.setHeader('Connection', 'close');
    res.once('finish', () => req.destroy());
    res.status(status).json({ erro: mensagem });
    req.resume();
  };
  const contar = (chunk: Buffer) => {
    bytes += chunk.length;
    if (bytes > MAX_CORPO_UPLOAD) recusar(413, 'Escolha uma foto de até 2 MB, sem outros arquivos ou campos.');
  };
  const cancelar = () => { encerrado = true; limpar(); };
  const prazo = setTimeout(() => recusar(408, 'O envio demorou demais. Tente novamente.'), DURACAO_UPLOAD_MS);
  prazo.unref();
  const tamanho = req.headers['content-length'];
  if (tamanho && (!/^\d+$/.test(tamanho) || Number(tamanho) > MAX_CORPO_UPLOAD)) {
    recusar(413, 'Escolha uma foto de até 2 MB, sem outros arquivos ou campos.'); return;
  }
  req.on('data', contar);
  req.once('aborted', cancelar);
  parser(req, res, (error?: unknown) => {
    if (encerrado) return;
    if (error) {
      const limite = error instanceof multer.MulterError;
      recusar(limite ? 413 : 415, limite ? 'Envie apenas uma foto de até 2 MB, sem outros campos.' : 'Escolha uma foto JPG, PNG ou WebP válida.');
      return;
    }
    encerrado = true;
    limpar();
    if (!req.file) { res.status(400).json({ erro: 'Nenhuma imagem enviada.' }); return; }
    next();
  });
}

// Usar somente depois da autenticação e da autorização do endpoint.
export const uploadImagem = [reservarUpload, porAtor, porTenant, receberImagem];
