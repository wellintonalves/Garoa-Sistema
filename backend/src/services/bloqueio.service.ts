import { prisma } from '../lib/prisma';
import { toBrasiliaDate } from '../lib/timezone';
import { ErroDeNegocio } from '../lib/erros';
import { AtorAgenda, escopoAgenda } from './acessoAgenda.service';
import { texto } from '../utils/entradaSegura.util';

export class BloqueioService {
  static async criar(barbeiroId: string, dataInicio: string | Date, dataFim: string | Date, motivo: string | undefined, ator: AtorAgenda) {
    const escopo = await escopoAgenda(ator);
    texto(barbeiroId);
    if (escopo.barbeiroId && escopo.barbeiroId !== barbeiroId) throw new ErroDeNegocio('Acesso não autorizado.', 403);
    const barbeiro = await prisma.barbeiro.findFirst({
      where: { id: barbeiroId, barbeariaId: escopo.barbeariaId, ativo: true }, select: { id: true },
    });
    if (!barbeiro) throw new ErroDeNegocio('Barbeiro não encontrado.', 404);
    const inicio = dataInicio instanceof Date ? dataInicio : toBrasiliaDate(texto(dataInicio, 40));
    const fim = dataFim instanceof Date ? dataFim : toBrasiliaDate(texto(dataFim, 40));
    if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(fim.getTime()) || fim <= inicio) {
      throw new ErroDeNegocio('Escolha um período válido para o bloqueio.');
    }
    const razao = motivo === undefined ? undefined : texto(motivo, 1000, true);
    const conflito = await prisma.bloqueioAgenda.findFirst({
      where: { barbeiroId, barbeiro: { barbeariaId: escopo.barbeariaId }, dataInicio: { lt: fim }, dataFim: { gt: inicio } },
    });
    if (conflito) throw new ErroDeNegocio('Já existe um bloqueio de agenda neste período.');
    return prisma.bloqueioAgenda.create({ data: { barbeiroId, dataInicio: inicio, dataFim: fim, motivo: razao } });
  }

  static async listar(filtros: { barbeiroId?: string; aPartirDe?: Date }, ator: AtorAgenda) {
    const escopo = await escopoAgenda(ator);
    return prisma.bloqueioAgenda.findMany({
      where: {
        // An optional barber filter never replaces this mandatory tenant predicate.
        barbeiro: { barbeariaId: escopo.barbeariaId },
        barbeiroId: escopo.barbeiroId ?? filtros.barbeiroId,
        dataFim: filtros.aPartirDe ? { gte: filtros.aPartirDe } : undefined,
      },
      orderBy: { dataInicio: 'asc' },
      select: {
        id: true, barbeiroId: true, dataInicio: true, dataFim: true, motivo: true,
        barbeiro: { select: { id: true, usuario: { select: { nome: true } } } },
      },
    });
  }

  static async remover(id: string, ator: AtorAgenda) {
    const escopo = await escopoAgenda(ator);
    const removido = await prisma.bloqueioAgenda.deleteMany({
      where: { id, barbeiro: { barbeariaId: escopo.barbeariaId }, barbeiroId: escopo.barbeiroId },
    });
    if (removido.count !== 1) throw new ErroDeNegocio('Bloqueio não encontrado.', 404);
  }
}
