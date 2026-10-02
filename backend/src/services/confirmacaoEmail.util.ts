import { ErroDeNegocio } from '../lib/erros';
/** Only thrown AFTER validating the password. No email-only account disclosure. */
export class ConfirmacaoEmailNecessaria extends ErroDeNegocio {
  constructor(public readonly usuarioId: string) { super('Confirme seu email antes de entrar.', 403); }
}
