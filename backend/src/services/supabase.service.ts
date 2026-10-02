import { registrarErroSeguro } from '../lib/logSeguro';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma';
import { ErroDeNegocio } from '../lib/erros';
import { MAX_IMAGEM_ARMAZENADA, normalizarImagem } from './imagemUpload.service';

export const MAX_IMAGENS_POR_RECURSO = 16;
export type BucketImagem = 'barbearias' | 'barbeiros';
export type AtorUpload = { barbeariaId: string; usuarioId: string; papel: 'ADMIN' | 'BARBEIRO'; barbeiroId?: string };
type ObjetoImagem = { name: string; id: string | null; metadata: { size?: unknown } | null };
export interface BucketUpload {
  list(prefixo: string, opcoes: { limit: number; offset: number; sortBy: { column: string; order: string } }): PromiseLike<{ data: ObjetoImagem[] | null; error: unknown }>;
  upload(path: string, buffer: Buffer, opcoes: { contentType: string; upsert: boolean; cacheControl: string }): PromiseLike<{ error: unknown }>;
  remove(paths: string[]): PromiseLike<{ data: { name: string }[] | null; error: unknown }>;
  getPublicUrl(path: string): { data: { publicUrl: string } };
}
const MARCADOR = Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vz0AAA=', 'base64');
const indisponivel = () => new ErroDeNegocio('Não foi possível enviar a foto agora. A foto atual foi mantida. Tente novamente em instantes.', 503);
const pendente = () => new ErroDeNegocio('Há um envio de foto em andamento ou aguardando confirmação. A foto atual foi mantida. Se persistir, entre em contato com o suporte.', 409);

/**
 * Nomes imutáveis evitam que uma escrita/exclusão remota atrasada atinja uma foto futura.
 * Um marcador create-only faz a admissão durar entre réplicas/reinícios. Em resultado remoto
 * incerto ele NÃO é removido: não há novas escritas até reconciliação explícita pelo suporte.
 * Só arquivos deste namespace novo, sem referência atual, são reciclados; legados nunca.
 */
export async function substituirImagemLimitada(
  bucket: BucketUpload, tenant: string, recurso: string, atual: string | null, buffer: Buffer,
  salvarReferencia: (url: string) => Promise<void>,
): Promise<string> {
  if (![tenant, recurso].every(id => /^[a-zA-Z0-9_-]{1,128}$/.test(id)) || buffer.length > MAX_IMAGEM_ARMAZENADA || !buffer.length) throw indisponivel();
  const raiz = `imagens-v2/${tenant}/${recurso}`;
  const guarda = `${raiz}/pendente.webp`;
  const prefixo = `${raiz}/arquivos`;
  const reserva = await bucket.upload(guarda, MARCADOR, { contentType: 'image/webp', upsert: false, cacheControl: '0' });
  if (reserva.error) throw pendente();
  // Não libere esta reserva no catch/finally: timeout não comprova ausência de efeito remoto.
  const objetos: ObjetoImagem[] = [];
  const pagina = 8;
  for (let offset = 0; ; offset += pagina) {
    const { data, error } = await bucket.list(prefixo, { limit: pagina, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error || !data || data.length > pagina) throw indisponivel();
    objetos.push(...data);
    if (objetos.length > MAX_IMAGENS_POR_RECURSO) throw pendente();
    if (data.length < pagina) break;
  }
  const nomes = new Set<string>();
  for (const objeto of objetos) {
    const tamanho = objeto.metadata?.size;
    if (!objeto.id || !/^[a-f0-9-]{36}\.webp$/.test(objeto.name) || nomes.has(objeto.name) ||
        typeof tamanho !== 'number' || !Number.isSafeInteger(tamanho) || tamanho < 0 || tamanho > MAX_IMAGEM_ARMAZENADA) throw indisponivel();
    nomes.add(objeto.name);
  }
  const caminhoPublico = (url: string | null) => {
    try { return url ? decodeURIComponent(new URL(url).pathname) : null; } catch { return null; }
  };
  const basePublica = caminhoPublico(bucket.getPublicUrl(`${prefixo}/`).data.publicUrl)!;
  const caminhoAtual = caminhoPublico(atual);
  // Um alias de domínio ou parâmetro de cache nunca transforma a foto atual em órfã.
  const atualGerenciada = Boolean(caminhoAtual?.startsWith(basePublica));
  const atualNoInventario = objetos.find(objeto => caminhoPublico(bucket.getPublicUrl(`${prefixo}/${objeto.name}`).data.publicUrl) === caminhoAtual);
  if (atualGerenciada && !atualNoInventario) throw indisponivel(); // RLS/listagem incompleta nunca libera quota.
  const descartadas = objetos.filter(objeto => objeto !== atualNoInventario).map(objeto => `${prefixo}/${objeto.name}`);
  if (descartadas.length) {
    const removidas = await bucket.remove(descartadas);
    if (removidas.error || !removidas.data || descartadas.some(path => !removidas.data!.some(objeto => objeto.name === path))) throw indisponivel();
  }
  const path = `${prefixo}/${randomUUID()}.webp`;
  const { error } = await bucket.upload(path, buffer, { contentType: 'image/webp', upsert: false, cacheControl: '31536000' });
  if (error) throw indisponivel();
  const url = bucket.getPublicUrl(path).data.publicUrl;
  await salvarReferencia(url);
  const liberada = await bucket.remove([guarda]);
  if (liberada.error || !liberada.data?.some(objeto => objeto.name === guarda)) throw indisponivel();
  return url;
}

let processamentosAtivos = 0;
export class SupabaseService {
  private static getClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) throw indisponivel();
    const ws = require('ws');
    return createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: ws },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5000) }) },
    });
  }

  static async uploadImage(bucket: BucketImagem, ator: AtorUpload, fileBuffer: Buffer, mimetype: string, recursoId?: string): Promise<string> {
    const recurso = bucket === 'barbearias' ? 'logo' : recursoId ?? ator.barbeiroId;
    if (!ator.barbeariaId || !ator.usuarioId || !recurso || !['barbearias', 'barbeiros'].includes(bucket) ||
        (ator.papel !== 'ADMIN' && (ator.papel !== 'BARBEIRO' || recurso !== ator.barbeiroId || bucket !== 'barbeiros'))) {
      throw new ErroDeNegocio('Você não tem permissão para enviar esta foto.', 403);
    }
    if (processamentosAtivos >= 4) throw new ErroDeNegocio('Já há fotos sendo processadas. Aguarde e tente novamente.', 429);
    processamentosAtivos++;
    try {
      const imagem = await normalizarImagem(fileBuffer, mimetype);
      const supabase = this.getClient();
      return await prisma.$transaction(async tx => {
        const [lock] = await tx.$queryRaw<{ adquirido: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtextextended(${'upload:' + ator.barbeariaId}, 0)) AS adquirido`;
        if (!lock?.adquirido) throw new ErroDeNegocio('Já há uma foto sendo enviada para esta barbearia. Aguarde e tente novamente.', 429);
        const unidade = await tx.barbearia.findFirst({ where: { id: ator.barbeariaId, ativo: true }, select: { id: true, logo: true } });
        const permitido = ator.papel === 'ADMIN'
          ? await tx.usuario.findFirst({ where: { id: ator.usuarioId, barbeariaId: ator.barbeariaId, papel: 'ADMIN' }, select: { id: true } })
          : await tx.barbeiro.findFirst({ where: { id: ator.barbeiroId, usuarioId: ator.usuarioId, barbeariaId: ator.barbeariaId, ativo: true,
              usuario: { papel: 'BARBEIRO', barbeariaId: ator.barbeariaId } }, select: { id: true } });
        const alvo = bucket === 'barbeiros' ? await tx.barbeiro.findFirst({ where: { id: recurso, barbeariaId: ator.barbeariaId }, select: { id: true, foto: true } }) : null;
        if (!unidade || !permitido || (bucket === 'barbeiros' && !alvo)) throw new ErroDeNegocio('Você não tem permissão para enviar esta foto.', 403);
        const atual = bucket === 'barbearias' ? unidade.logo : alvo!.foto;
        return substituirImagemLimitada(supabase.storage.from(bucket), ator.barbeariaId, recurso, atual, imagem, async url => {
          const mudanca = bucket === 'barbearias'
            ? await tx.barbearia.updateMany({ where: { id: ator.barbeariaId, logo: atual }, data: { logo: url } })
            : await tx.barbeiro.updateMany({ where: { id: recurso, barbeariaId: ator.barbeariaId, foto: atual }, data: { foto: url } });
          if (mudanca.count !== 1) throw new ErroDeNegocio('A foto foi alterada em outra sessão. Atualize a página e tente novamente.', 409);
        });
      }, { maxWait: 1000, timeout: 35_000 });
    } catch (error) {
      if (error instanceof ErroDeNegocio) throw error;
      registrarErroSeguro('services.supabase.service.falha', undefined);
      throw indisponivel();
    } finally { processamentosAtivos--; }
  }
}
