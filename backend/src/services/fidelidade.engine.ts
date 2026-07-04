import { prisma } from '../lib/prisma';

/**
 * Motor de fidelidade unificado.
 * Executa as regras de pontuação de forma idempotente para um agendamento específico.
 * @param agendamentoId ID do agendamento concluído
 */
export async function creditarPontosPorAgendamento(agendamentoId: string) {
  const agendamento = await prisma.agendamento.findUnique({
    where: { id: agendamentoId },
    include: {
      servico: { select: { nome: true, duracaoMinutos: true, cor: true, preco: true } },
    }
  });

  if (!agendamento) {
    console.error(`[Fidelidade] Agendamento não encontrado: ${agendamentoId}`);
    return;
  }

  if (agendamento.status !== 'CONCLUIDO') {
    console.warn(`[Fidelidade] Agendamento ${agendamentoId} não está concluído, ignorando pontuação.`);
    return;
  }

  if (!agendamento.clienteId || !agendamento.barbeariaId) {
    return;
  }

  // Idempotência: verificar se já existe pontuação para este agendamento
  const pontuacaoExistente = await prisma.pontoFidelidade.findUnique({
    where: { agendamentoId: agendamento.id },
  });

  if (pontuacaoExistente) {
    console.log(`[Fidelidade] Pontuação já registrada para o agendamento ${agendamento.id}`);
    return;
  }

  const config = await prisma.configuracaoFidelidade.findUnique({
    where: { barbeariaId: agendamento.barbeariaId },
  });

  // Só pontua se o programa de fidelidade estiver ativo
  if (config && config.ativo) {
    let pontos = 0;
    let descricao = '';

    // 1. Regra por serviço (prioridade máxima)
    const regrasPorServico = (config.regrasPorServico as Array<{ servicoId: string; pontos: number }> | null) ?? [];
    const regraServico = regrasPorServico.find(r => r.servicoId === agendamento.servicoId);

    if (regraServico && regraServico.pontos > 0) {
      pontos = regraServico.pontos;
      descricao = `${agendamento.servico?.nome} — regra específica do serviço`;
    }
    // 2. Pontos por real gasto
    else if (config.pontosPorReal > 0 && agendamento.servico?.preco) {
      pontos = Math.floor(Number(agendamento.servico.preco) * config.pontosPorReal);
      descricao = `${agendamento.servico.nome} — ${config.pontosPorReal} ponto(s) por R$1,00`;
    }
    // 3. Pontos fixos por visita
    else if (config.pontosPorVisita > 0) {
      pontos = config.pontosPorVisita;
      descricao = `${agendamento.servico?.nome} — visita concluída`;
    }

    // Dobra pontos no aniversário do cliente
    if (pontos > 0 && config.pontosDobroAniversario && agendamento.clienteId) {
      const cliente = await prisma.cliente.findUnique({
        where: { id: agendamento.clienteId },
        select: { dataNascimento: true },
      });

      if (cliente?.dataNascimento) {
        const hoje = new Date();
        const nasc = new Date(cliente.dataNascimento);
        if (
          nasc.getDate() === hoje.getDate() &&
          nasc.getMonth() === hoje.getMonth()
        ) {
          pontos = pontos * 2;
          descricao += ' (dobro — aniversário!)';
        }
      }
    }

    // Registra pontos do cliente
    if (pontos > 0) {
      await prisma.pontoFidelidade.create({
        data: {
          clienteId: agendamento.clienteId,
          barbeariaId: agendamento.barbeariaId,
          agendamentoId: agendamento.id,
          pontos,
          descricao,
        },
      });
      console.log(`[Fidelidade] ${pontos} pontos registrados para cliente ${agendamento.clienteId} no agendamento ${agendamento.id}`);
    }

    // Verifica se é o primeiro agendamento CONCLUIDO do cliente nesta barbearia
    // para premiar quem o indicou
    if ((config as any).pontosPorIndicacao > 0) {
      const concluidosAnteriores = await prisma.agendamento.count({
        where: {
          clienteId: agendamento.clienteId,
          barbeariaId: agendamento.barbeariaId,
          status: 'CONCLUIDO',
          id: { not: agendamento.id },
        },
      });

      if (concluidosAnteriores === 0) {
        // É o primeiro! Verifica se há indicação pendente
        const indicacao = await (prisma as any).indicacao.findFirst({
          where: {
            indicadoId: agendamento.clienteId,
            barbeariaId: agendamento.barbeariaId,
            pontosAwardados: false,
          },
        });

        if (indicacao) {
          const pontosIndicacao = (config as any).pontosPorIndicacao as number;
          await prisma.pontoFidelidade.create({
            data: {
              clienteId: indicacao.indicadorId,
              barbeariaId: agendamento.barbeariaId,
              pontos: pontosIndicacao,
              descricao: 'Indicação bem-sucedida — amigo completou primeiro agendamento',
            },
          });
          await (prisma as any).indicacao.update({
            where: { id: indicacao.id },
            data: { pontosAwardados: true },
          });
          console.log(`[Fidelidade] ${pontosIndicacao} pontos de indicação registrados para indicador ${indicacao.indicadorId}`);
        }
      }
    }
  }
}
