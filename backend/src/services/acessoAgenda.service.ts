import { prisma } from '../lib/prisma';
import { tenantStorage } from '../lib/als';
import { ErroDeNegocio } from '../lib/erros';
import type { UsuarioJWT } from '../types';

export type AtorAgenda = Pick<UsuarioJWT, 'id' | 'papel' | 'barbeariaId'>;

/** The actor comes from authentication, never from a request body. Fails closed. */
export async function escopoAgenda(ator: AtorAgenda | undefined): Promise<{ barbeariaId: string; barbeiroId?: string }> {
  if (!ator?.id || !ator.barbeariaId || !['ADMIN', 'BARBEIRO'].includes(ator.papel)) {
    throw new ErroDeNegocio('Acesso não autorizado.', 403);
  }
  const contexto = tenantStorage.getStore()?.barbeariaId;
  if (contexto && contexto !== ator.barbeariaId) throw new ErroDeNegocio('Acesso não autorizado.', 403);
  if (ator.papel === 'ADMIN') return { barbeariaId: ator.barbeariaId };
  const barbeiro = await prisma.barbeiro.findFirst({
    where: { usuarioId: ator.id, barbeariaId: ator.barbeariaId, ativo: true },
    select: { id: true },
  });
  if (!barbeiro) throw new ErroDeNegocio('Acesso não autorizado.', 403);
  return { barbeariaId: ator.barbeariaId, barbeiroId: barbeiro.id };
}

export async function validarVinculoCliente(clienteId: string, barbeariaId: string): Promise<void> {
  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, usuario: { papel: 'CLIENTE' }, OR: [
      { barbeariaId }, { clientesBarbearias: { some: { barbeariaId, ativo: true } } },
    ], NOT: { clientesBarbearias: { some: { barbeariaId, ativo: false } } } },
    select: { id: true },
  });
  if (!cliente) throw new ErroDeNegocio('Cliente não disponível nesta barbearia.', 404);
}
