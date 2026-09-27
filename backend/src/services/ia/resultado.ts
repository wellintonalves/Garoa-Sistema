import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ErroDeNegocio } from '../../lib/erros';

export function configuracaoResultado(env: NodeJS.ProcessEnv = process.env) {
  const encoded = env.IA_RESULTADO_CHAVE_BASE64 || '';
  const chave = Buffer.from(encoded, 'base64');
  const horas = Number(env.IA_RESULTADO_RETENCAO_HORAS);
  if (chave.length !== 32 || chave.toString('base64') !== encoded || !Number.isInteger(horas) || horas < 1 || horas > 720) {
    throw new ErroDeNegocio('A assistente aguarda configuração de privacidade dos resultados.', 503);
  }
  return { chave, horas };
}

export function cifrarResultado(texto: string, chave: Buffer, reservaId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', chave, iv);
  cipher.setAAD(Buffer.from(reservaId));
  const dados = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), dados]).toString('base64');
}
export function decifrarResultado(texto: string, chave: Buffer, reservaId: string) {
  try {
    const dados = Buffer.from(texto, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', chave, dados.subarray(0, 12));
    decipher.setAAD(Buffer.from(reservaId));
    decipher.setAuthTag(dados.subarray(12, 28));
    return Buffer.concat([decipher.update(dados.subarray(28)), decipher.final()]).toString('utf8');
  } catch { throw new ErroDeNegocio('Não foi possível recuperar a resposta salva. Consulte o suporte.', 503); }
}
