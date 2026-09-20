import { ErroDeNegocio } from '../../lib/erros';

export const VERSAO_DOCUMENTOS = '2026-09-15';

/** O horário e a origem são definidos no servidor, nunca pelo navegador. */
export function registrarAceiteDocumentos(entrada: unknown, origem: 'CADASTRO_ADMIN' | 'CADASTRO_CLIENTE' | 'CADASTRO_TENANT') {
  const valor = entrada as Record<string, unknown> | null;
  if (!valor || valor.aceito !== true || valor.termosVersao !== VERSAO_DOCUMENTOS || valor.privacidadeVersao !== VERSAO_DOCUMENTOS) {
    throw new ErroDeNegocio('Leia e aceite os Termos de Uso e confirme a ciência da Política de Privacidade atual para criar sua conta.', 400);
  }
  return {
    aceiteDocumentosEm: new Date(),
    termosUsoVersao: VERSAO_DOCUMENTOS,
    privacidadeVersao: VERSAO_DOCUMENTOS,
    aceiteDocumentosOrigem: origem,
  };
}
