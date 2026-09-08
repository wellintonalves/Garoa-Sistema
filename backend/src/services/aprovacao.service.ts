import { StatusAprovacao } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { FinanceiroService } from './financeiro.service';

export class AprovacaoService {
  /**
   * Lista as aprovações pendentes para um barbeiro específico.
   */
  static async listarPendentes(barbeiroId: string) {
    return prisma.aprovacaoEdicao.findMany({
      where: {
        barbeiroId,
        status: StatusAprovacao.PENDENTE,
      },
      include: {
        lancamento: {
          include: {
            servico: true,
          }
        },
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Aprova uma solicitação e aplica a alteração no banco.
   */
  static async aprovar(aprovacaoId: string, barbeiroId: string) {
    const aprovacao = await prisma.aprovacaoEdicao.findUnique({
      where: { id: aprovacaoId },
    });

    if (!aprovacao) throw new Error('Aprovação não encontrada.');
    if (aprovacao.barbeiroId !== barbeiroId) throw new Error('Não autorizado.');
    if (aprovacao.status !== StatusAprovacao.PENDENTE) throw new Error('Aprovação já processada.');

    // Aplicar a alteração
    if (aprovacao.acao === 'EXCLUIR') {
      await prisma.lancamentoFinanceiro.delete({ where: { id: aprovacao.lancamentoId } });
      // A aprovação é excluída em cascata quando o lançamento é deletado.
      return { id: aprovacaoId, status: StatusAprovacao.APROVADO };
    } else if (aprovacao.acao === 'EDITAR' && aprovacao.dadosNovos) {
      const dados = aprovacao.dadosNovos as Parameters<typeof FinanceiroService.atualizar>[1];
      await FinanceiroService.atualizar(aprovacao.lancamentoId, dados, true);
    } else if (aprovacao.acao === 'ADICIONAR' && aprovacao.dadosNovos) {
      const dados = aprovacao.dadosNovos as unknown as Parameters<typeof FinanceiroService.criar>[0];
      await FinanceiroService.criar(dados);
    }

    return prisma.aprovacaoEdicao.update({
      where: { id: aprovacaoId },
      data: { status: StatusAprovacao.APROVADO },
    });
  }

  /**
   * Rejeita a solicitação.
   */
  static async rejeitar(aprovacaoId: string, barbeiroId: string) {
    const aprovacao = await prisma.aprovacaoEdicao.findUnique({
      where: { id: aprovacaoId },
    });

    if (!aprovacao) throw new Error('Aprovação não encontrada.');
    if (aprovacao.barbeiroId !== barbeiroId) throw new Error('Não autorizado.');
    if (aprovacao.status !== StatusAprovacao.PENDENTE) throw new Error('Aprovação já processada.');

    return prisma.aprovacaoEdicao.update({
      where: { id: aprovacaoId },
      data: { status: StatusAprovacao.REJEITADO },
    });
  }
}
