import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { avaliarRetencaoFinanceira, prazoRetencaoFinanceira } from '../domain/privacidade/retencaoOperacional';

type Banco = Prisma.TransactionClient | typeof prisma;

/** Fila interna de revisão. Nunca exclui registros, abre acesso, aprova retenção legal ou dispara limpeza de backups. */
export async function triarRetencaoEncerramentos(banco: Banco = prisma, agora = new Date()) {
  const candidatas = await banco.assinaturaSaas.findMany({
    where: { OR: [{ status: { in: ['CONSULTA_EXPORTACAO', 'ENCERRADA'] } }, { renovacaoAutomatica: false }], fimAcessoEm: { not: null, lte: agora } },
    select: { id: true, barbeariaId: true, fimAcessoEm: true, consultaExportacaoAte: true },
  });
  let assinaturasTriadas = 0;
  for (const assinatura of candidatas) {
    const fim = assinatura.fimAcessoEm!;
    const fimConsulta = assinatura.consultaExportacaoAte ?? new Date(fim.getTime() + 30 * 86400000);
    if (agora < fimConsulta) continue;
    const prazo = prazoRetencaoFinanceira(fim);
    const estado = avaliarRetencaoFinanceira(fim, agora, false);
    const itens = [
      { entidade: 'REVISAO_DADOS_ASSINATURA', motivoRetencao: 'Janela de consulta/exportação encerrada. Aguardando revisão por categoria, vínculos com outras barbearias e autorização individual. Nenhuma exclusão autorizada por esta triagem.' },
      { entidade: 'REVISAO_FINANCEIRO_ASSINATURA', motivoRetencao: `${estado}. Prazo operacional de suporte: 12 meses de calendário desde fimAcessoEm=${fim.toISOString()}, até ${prazo.toISOString()}. Não é prazo legal. Após esse marco, revisar obrigação legal/disputa e autorização antes de qualquer exclusão.` },
    ];
    for (const item of itens) {
      await banco.exclusaoDadosAuditavel.createMany({
        data: [{ ...item, registroId: assinatura.id, barbeariaId: assinatura.barbeariaId, status: 'AGUARDANDO_POLITICA', retencaoLegal: false, solicitadoEm: agora }],
        skipDuplicates: true,
      });
      // Não altera hold, decisões manuais, exclusão confirmada ou justificativas de processos já revisados.
      await banco.exclusaoDadosAuditavel.updateMany({
        where: { entidade: item.entidade, registroId: assinatura.id, status: 'AGUARDANDO_POLITICA', retencaoLegal: false, excluidoPrincipalEm: null },
        data: { motivoRetencao: item.motivoRetencao },
      });
    }
    assinaturasTriadas += 1;
  }
  return { assinaturasTriadas, exclusoesExecutadas: 0 };
}
