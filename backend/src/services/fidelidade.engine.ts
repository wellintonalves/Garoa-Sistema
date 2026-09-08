import { prisma } from '../lib/prisma';
import { obterIdsServicosAgendamento } from '../utils/agendamento.util';
import { somarPontosPorServicos, calcularPontosAtendimento } from '../utils/fidelidade.util';

export interface OperacoesFidelidade {
  pontosParaCriar: Array<{
    clienteId: string;
    barbeariaId: string;
    agendamentoId?: string;
    lancamentoId?: string;
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
  servicoId: string | string[],
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

  const ids = Array.isArray(servicoId) ? servicoId : [servicoId];
  const servicos = await prisma.servico.findMany({ where: { id: { in: ids }, barbeariaId }, select: { id: true, nome: true } });
  const nomes = new Map(servicos.map(s => [s.id, s.nome]));
  const servicoNome = ids.map(id => nomes.get(id) || 'Serviço').join(' + ') || 'Serviço';
  const pontosServicos = somarPontosPorServicos(ids, config.regrasPorServico);

  if (pontosServicos > 0) {
    pontos = pontosServicos;
    descricao = `${servicoNome} — regra específica do serviço`;
  } else if (config.pontosPorReal > 0 && precoServico) {
    pontos = Math.floor(Number(precoServico) * config.pontosPorReal);
    descricao = `${servicoNome} — ${config.pontosPorReal} ponto(s) por R$1,00`;
  } else if (config.pontosPorVisita > 0) {
    pontos = config.pontosPorVisita;
    descricao = `${servicoNome} — visita concluída`;
  }

  const pontosFinais = calcularPontosAtendimento(config, ids, Number(precoServico ?? 0), cliente?.dataNascimento);
  if (pontosFinais > pontos) descricao += ' (dobro — aniversário!)';
  pontos = pontosFinais;

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
 * Lê os dados necessários para o cálculo de pontos de fidelidade para um Lançamento Avulso.
 */
export async function prepararOperacoesFidelidadeLancamento(
  lancamentoId: string,
  clienteId: string,
  barbeariaId: string,
  servicoId: string | string[] | null,
  preco: number
): Promise<OperacoesFidelidade> {
  const operacoes: OperacoesFidelidade = { pontosParaCriar: [] };

  const [pontuacaoExistente, config, cliente] = await Promise.all([
    prisma.pontoFidelidade.findFirst({ where: { lancamentoId } }),
    prisma.configuracaoFidelidade.findUnique({ where: { barbeariaId } }),
    prisma.cliente.findUnique({ where: { id: clienteId }, select: { dataNascimento: true } })
  ]);

  if (pontuacaoExistente || !config || !config.ativo) {
    return operacoes;
  }

  let pontos = 0;
  let descricao = '';
  let servicoNome = 'Avulso';

  if (servicoId) {
    const ids = Array.isArray(servicoId) ? servicoId : [servicoId];
    const servicos = await prisma.servico.findMany({ where: { id: { in: ids }, barbeariaId }, select: { id: true, nome: true } });
    const nomes = new Map(servicos.map(s => [s.id, s.nome]));
    servicoNome = ids.map(id => nomes.get(id) || 'Serviço').join(' + ') || 'Avulso';
    pontos = somarPontosPorServicos(ids, config.regrasPorServico);
    if (pontos > 0) {
      descricao = `${servicoNome} — regra específica do serviço`;
    }
  }

  if (pontos === 0) {
    if (config.pontosPorReal > 0 && preco > 0) {
      pontos = Math.floor(Number(preco) * config.pontosPorReal);
      descricao = `${servicoNome} — ${config.pontosPorReal} ponto(s) por R$1,00`;
    } else if (config.pontosPorVisita > 0) {
      pontos = config.pontosPorVisita;
      descricao = `${servicoNome} — visita concluída`;
    }
  }

  const pontosFinais = calcularPontosAtendimento(config,
    Array.isArray(servicoId) ? servicoId : servicoId ? [servicoId] : [], preco, cliente?.dataNascimento);
  if (pontosFinais > pontos) descricao += ' (dobro — aniversário!)';
  pontos = pontosFinais;

  if (pontos > 0) {
    operacoes.pontosParaCriar.push({
      clienteId,
      barbeariaId,
      lancamentoId,
      pontos,
      descricao
    });
  }

  return operacoes;
}

/**
 * Legado para manter compatibilidade, mas agora usa a função pura internamente se for rodar sozinho
 */
export async function creditarPontosPorAgendamento(agendamentoId: string) {
  const agendamento = await prisma.agendamento.findUnique({
    where: { id: agendamentoId },
    include: { servico: true, itens: true }
  });

  if (!agendamento || agendamento.status !== 'CONCLUIDO' || !agendamento.clienteId || !agendamento.barbeariaId) return;

  const ops = await prepararOperacoesFidelidade(
    agendamentoId,
    agendamento.clienteId,
    agendamento.barbeariaId,
    obterIdsServicosAgendamento(agendamento),
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
