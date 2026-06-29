import { PrismaClient, StatusAprovacao } from '@prisma/client';

const prisma = new PrismaClient();

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
    } else if (aprovacao.acao === 'EDITAR' && aprovacao.dadosNovos) {
      const dados = aprovacao.dadosNovos as any;
      await prisma.lancamentoFinanceiro.update({
        where: { id: aprovacao.lancamentoId },
        data: {
          ...dados,
          data: dados.data ? new Date(dados.data) : undefined,
        },
      });
    } else if (aprovacao.acao === 'ADICIONAR' && aprovacao.dadosNovos) {
      const dados = aprovacao.dadosNovos as any;
      const original = await prisma.lancamentoFinanceiro.findUnique({ where: { id: aprovacao.lancamentoId } });
      
      let valorComissao = dados.valorComissao || null;
      let valorLiquido = dados.valorLiquido || null;

      if (dados.tipo === 'ENTRADA' && dados.barbeiroId && dados.valor) {
        const barbeiro = await prisma.barbeiro.findUnique({
          where: { id: dados.barbeiroId },
          select: { comissaoPercent: true }
        });
        if (barbeiro && barbeiro.comissaoPercent != null) {
          valorComissao = (dados.valor * barbeiro.comissaoPercent) / 100;
          valorLiquido = dados.valor - valorComissao;
        }
      }

      await prisma.lancamentoFinanceiro.create({
        data: {
          ...dados,
          valorComissao,
          valorLiquido,
          barbeariaId: original?.barbeariaId, // Importante para não sumir do painel
          data: dados.data ? new Date(dados.data) : new Date(),
        }
      });
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
