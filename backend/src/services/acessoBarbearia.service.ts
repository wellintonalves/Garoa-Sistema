import { prisma } from '../lib/prisma';
import { ErroDeNegocio } from '../lib/erros';

/** Sem cache: bloqueia também tokens emitidos antes da desativação. */
export async function validarBarbeariaAtiva(barbeariaId: string | null | undefined): Promise<void> {
  if (!barbeariaId) return;
  const barbearia = await prisma.barbearia.findUnique({ where: { id: barbeariaId }, select: { ativo: true } });
  if (!barbearia?.ativo) throw new ErroDeNegocio('Acesso a esta barbearia desativado. Entre em contato com o suporte.', 403);
}
