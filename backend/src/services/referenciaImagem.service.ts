import { ErroDeNegocio } from '../lib/erros';

/** URLs novas só podem ser publicadas pelo fluxo que valida os pixels e o recurso. */
export function validarReferenciaImagemRecebida(recebida: unknown, atual: string | null | undefined): void {
  if (recebida === undefined || recebida === null || recebida === '' || recebida === atual) return;
  throw new ErroDeNegocio('Use o envio de foto para alterar a imagem.', 400);
}
