import sharp from 'sharp';
import { ErroDeNegocio } from '../lib/erros';

export const MAX_ARQUIVO_IMAGEM = 2 * 1024 * 1024;
export const MAX_IMAGEM_ARMAZENADA = 512 * 1024;
export const MAX_PIXELS_IMAGEM = 16_000_000;
export const MAX_DIMENSAO_IMAGEM = 8192;

const tipos = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;
type Formato = keyof typeof tipos;

function identificarFormato(bytes: Buffer): Formato | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

function pngAnimado(bytes: Buffer): boolean {
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const tamanho = bytes.readUInt32BE(offset);
    if (tamanho > bytes.length - offset - 12) return false; // O decoder rejeitará o truncamento.
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'acTL') return true;
    offset += tamanho + 12;
  }
  return false;
}

/** Apenas pixels decodificados são publicados. Nome/extensão/EXIF do cliente não são preservados. */
export async function normalizarImagem(bytes: Buffer, tipoInformado: string): Promise<Buffer> {
  if (!bytes.length || bytes.length > MAX_ARQUIVO_IMAGEM) {
    throw new ErroDeNegocio('Escolha uma foto de até 2 MB.', 413);
  }
  const formato = identificarFormato(bytes);
  if (!formato || tipoInformado !== tipos[formato] || (formato === 'png' && pngAnimado(bytes))) {
    throw new ErroDeNegocio('Escolha uma foto JPG, PNG ou WebP válida.', 415);
  }
  try {
    const imagem = sharp(bytes, { failOn: 'warning', limitInputPixels: MAX_PIXELS_IMAGEM, sequentialRead: true, pages: 1 });
    const dados = await imagem.metadata();
    if (dados.format !== formato || !dados.width || !dados.height || dados.width > MAX_DIMENSAO_IMAGEM ||
        dados.height > MAX_DIMENSAO_IMAGEM || dados.width * dados.height > MAX_PIXELS_IMAGEM || (dados.pages ?? 1) > 1) {
      throw new Error('Dimensões, formato ou animação não permitidos');
    }
    // A decodificação completa detecta arquivos truncados/poliglotas; a saída não inclui metadados.
    const resultado = await imagem.rotate().resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, effort: 3 }).timeout({ seconds: 8 }).toBuffer();
    if (resultado.length > MAX_IMAGEM_ARMAZENADA) {
      throw new ErroDeNegocio('Esta foto é muito complexa. Escolha uma imagem menor.', 413);
    }
    return resultado;
  } catch (error) {
    if (error instanceof ErroDeNegocio) throw error;
    throw new ErroDeNegocio('Não foi possível ler esta foto. Escolha uma imagem JPG, PNG ou WebP válida.', 415);
  }
}
