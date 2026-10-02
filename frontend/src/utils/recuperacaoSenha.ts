export type PapelRecuperacao = 'ADMIN' | 'CLIENTE' | 'BARBEIRO';

export type ContextoRecuperacao = Readonly<{
  email: string;
  papel: PapelRecuperacao;
  barbeariaSlug?: string;
}>;

export function papelRecuperacaoDoPerfil(perfil: string | null): PapelRecuperacao {
  switch (perfil) {
    case 'admin': return 'ADMIN';
    case 'barbeiro': return 'BARBEIRO';
    default: return 'CLIENTE';
  }
}

// Capture os dados enviados uma única vez; reenvio e redefinição usam a mesma conta.
export function criarContextoRecuperacao(dados: ContextoRecuperacao): ContextoRecuperacao {
  const barbeariaSlug = dados.barbeariaSlug?.trim().toLowerCase();
  return Object.freeze({
    email: dados.email.trim().toLowerCase(),
    papel: dados.papel,
    ...(barbeariaSlug ? { barbeariaSlug } : {}),
  });
}

export function loginDaRecuperacao(contexto: Pick<ContextoRecuperacao, 'papel' | 'barbeariaSlug'>): string {
  if (contexto.papel === 'ADMIN') return '/admin/login';
  if (contexto.papel === 'BARBEIRO') return '/barbeiro/login';
  const slug = contexto.barbeariaSlug?.trim().toLowerCase();
  return slug ? `/b/${encodeURIComponent(slug)}/login` : '/';
}
