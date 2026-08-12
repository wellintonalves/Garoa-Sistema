import { prisma } from '../lib/prisma';
import { Agendamento, ConfiguracaoFidelidade, Servico, Cliente } from '@prisma/client';

export interface OperacoesFidelidade {
  pontosParaCriar: Array<{
    clienteId: string;
    barbeariaId: string;
    agendamentoId?: string;
    pontos: number;
    descricao: string;
  }>;
  indicacaoParaAtualizarId?: string;
}

/**
 * Lê os dados necessários para o cálculo de pontos de fidelidade (fora da transação principal).
 */
export async function prepararOperacoesFidelidade(
  agendamentoId: string,
  clienteId: string,
  barbeariaId: string,
  servicoId: string,
  precoServico: number | null
): Promise<OperacoesFidelidade> {
  const operacoes: OperacoesFidelidade = { pontosParaCriar: [] };

  const [pontuacaoExistente, config, cliente] = await Promise.all([
    prisma.pontoFidelidade.findFirst({ where: { agendamentoId } }),
    prisma.configuracaoFidelidade.findUnique({ where: { barbeariaId } }),
    prisma.cliente.findUnique({ where: { id: clienteId }, select: { dataNascimento: true } })
  ]);

  if (pontuacaoExistente) {
    return operacoes;
  }

  if (!config || !config.ativo) {
    return operacoes;
  }

  let pontos = 0;
  let descricao = '';

  const regrasPorServico = (config.regrasPorServico as Array<{ servicoId: string; pontos: number }> | null) ?? [];
  const regraServico = regrasPorServico.find(r => r.servicoId === servicoId);

  const servicoNome = (await prisma.servico.findUnique({ where: { id: servicoId }, select: { nome: true } }))?.nome || 'Serviço';

  if (regraServico && regraServico.pontos > 0) {
    pontos = regraServico.pontos;
    descricao = `${servicoNome} — regra específica do serviço`;
  } else if (config.pontosPorReal > 0 && precoServico) {
    pontos = Math.floor(Number(precoServico) * config.pontosPorReal);
    descricao = `${servicoNome} — ${config.pontosPorReal} ponto(s) por R$1,00`;
  } else if (config.pontosPorVisita > 0) {
    pontos = config.pontosPorVisita;
    descricao = `${servicoNome} — visita concluída`;
  }

  if (pontos > 0 && config.pontosDobroAniversario && cliente?.dataNascimento) {
    const hoje = new Date();
    const nasc = new Date(cliente.dataNascimento);
    if (nasc.getDate() === hoje.getDate() && nasc.getMonth() === hoje.getMonth()) {
      pontos = pontos * 2;
      descricao += ' (dobro — aniversário!)';
    }
  }

  if (pontos > 0) {
    operacoes.pontosParaCriar.push({
      clienteId,
      barbeariaId,
      agendamentoId,
      pontos,
      descricao
    });
  }

  if ((config as any).pontosPorIndicacao > 0) {
    const concluidosAnteriores = await prisma.agendamento.count({
      where: {
        clienteId,
        barbeariaId,
        status: 'CONCLUIDO',
        id: { not: agendamentoId },
      },
    });

    if (concluidosAnteriores === 0) {
      const indicacao = await (prisma as any).indicacao.findFirst({
        where: {
          indicadoId: clienteId,
          barbeariaId,
          pontosAwardados: false,
        },
      });

      if (indicacao) {
        const pontosIndicacao = (config as any).pontosPorIndicacao as number;
        const pontosParaIndicado = ((config as any).pontosParaIndicado as number) || 0;

        if (pontosIndicacao > 0) {
          operacoes.pontosParaCriar.push({
            clienteId: indicacao.indicadorId,
            barbeariaId,
            pontos: pontosIndicacao,
            descricao: 'Indicação bem-sucedida — amigo completou primeiro agendamento'
          });
        }
        if (pontosParaIndicado > 0) {
          operacoes.pontosParaCriar.push({
            clienteId: indicacao.indicadoId,
            barbeariaId,
            pontos: pontosParaIndicado,
            descricao: 'Ganho de pontos por ser indicado'
          });
        }
        operacoes.indicacaoParaAtualizarId = indicacao.id;
      }
    }
  }

  return operacoes;
}

/**
 * Legado para manter compatibilidade, mas agora usa a função pura internamente se for rodar sozinho
 */
export async function creditarPontosPorAgendamento(agendamentoId: string) {
  const agendamento = await prisma.agendamento.findUnique({
    where: { id: agendamentoId },
    include: { servico: true }
  });

  if (!agendamento || agendamento.status !== 'CONCLUIDO' || !agendamento.clienteId || !agendamento.barbeariaId) return;

  const ops = await prepararOperacoesFidelidade(
    agendamentoId,
    agendamento.clienteId,
    agendamento.barbeariaId,
    agendamento.servicoId,
    Number(agendamento.servico?.preco || 0)
  );

  if (ops.pontosParaCriar.length > 0 || ops.indicacaoParaAtualizarId) {
    await prisma.$transaction(async (tx) => {
      for (const op of ops.pontosParaCriar) {
        await tx.pontoFidelidade.create({ data: op });
      }
      if (ops.indicacaoParaAtualizarId) {
        await (tx as any).indicacao.update({
          where: { id: ops.indicacaoParaAtualizarId },
          data: { pontosAwardados: true }
        });
      }
    });
  }
}
