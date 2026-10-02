/** Prisma query extension: credential/security changes and revocation share one DB write. */
export function versionarAtualizacaoUsuario(operacao: string, args: Record<string, unknown>): void {
  const campo = operacao === 'upsert' ? 'update' : 'data';
  const data = args[campo];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return;
  const dados = data as Record<string, unknown>;
  if (['senha', 'email', 'papel', 'barbeariaId', 'barbearia', 'emailVerificado'].some(chave => dados[chave] !== undefined)) {
    dados.authVersion = { increment: 1 };
  }
}
