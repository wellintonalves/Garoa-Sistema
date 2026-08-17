import { prisma } from '../lib/prisma';

export class ConfiguracaoService {
  /** Busca a configuração da barbearia. Se não existir, cria uma padrão. */
  static async obter(barbeariaId?: string | null) {
    let config = await prisma.configuracao.findFirst(barbeariaId ? { where: { barbeariaId } } : undefined);

    let bId = barbeariaId;
    if (!bId && config) {
      bId = config.barbeariaId;
    }
    if (!bId && !config) {
      const b = await prisma.barbearia.findFirst();
      if (b) bId = b.id;
    }

    const barbearia = bId ? await prisma.barbearia.findUnique({ where: { id: bId } }) : null;

    let precisaAtualizar = false;
    let horariosFuncionamento: any = config?.horariosFuncionamento;

    if (!horariosFuncionamento || Object.keys(horariosFuncionamento).length === 0) {
      const baseAbertura = barbearia?.horarioAbertura || '09:00';
      const baseFechamento = barbearia?.horarioFechamento || '19:00';
      const baseTemAlmoco = barbearia?.temAlmoco || false;
      const baseAlmocoInicio = barbearia?.horarioAlmocoInicio || '12:00';
      const baseAlmocoFim = barbearia?.horarioAlmocoFim || '13:00';
      const diasFuncionais = barbearia?.diasFuncionamento || ['1', '2', '3', '4', '5', '6'];

      const diasSemanaMapa: Record<string, string> = {
        '0': 'domingo', '1': 'segunda', '2': 'terca', '3': 'quarta',
        '4': 'quinta', '5': 'sexta', '6': 'sabado', '7': 'domingo'
      };

      const mapFinal: any = {};
      const diasNomes = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
      for (const diaNome of diasNomes) {
        mapFinal[diaNome] = { fechado: true };
      }

      for (const d of diasFuncionais) {
        const diaNome = diasSemanaMapa[d];
        if (diaNome) {
          mapFinal[diaNome] = {
            fechado: false,
            abertura: baseAbertura,
            fechamento: baseFechamento,
            temAlmoco: baseTemAlmoco,
            almocoInicio: baseAlmocoInicio,
            almocoFim: baseAlmocoFim,
          };
        }
      }

      horariosFuncionamento = mapFinal;
      precisaAtualizar = true;
    }

    if (!config) {
      config = await prisma.configuracao.create({
        data: {
          barbeariaId: bId,
          horariosFuncionamento,
          regrasFidelidade: { pontosParaRecompensa: 10 } as any,
        } as any,
      });
    } else if (precisaAtualizar) {
      config = await prisma.configuracao.update({
        where: { id: config.id },
        data: { horariosFuncionamento },
      });
    }

    return config;
  }

  /** Atualiza a configuração. Passa o payload completo de atualização. */
  static async atualizar(dados: any, barbeariaId?: string | null) {
    const configAtual = await this.obter(barbeariaId);
    const updated = await prisma.configuracao.update({
      where: { id: configAtual.id },
      data: dados,
    });

    let conflitosGerados: any[] = [];
    if (dados.horariosFuncionamento) {
      const hoje = new Date();
      const agendamentosFuturos = await prisma.agendamento.findMany({
        where: {
          barbeariaId: updated.barbeariaId,
          status: { in: ['AGUARDANDO', 'CONFIRMADO'] },
          dataHora: { gte: hoje },
        },
        include: {
          cliente: { include: { usuario: { select: { nome: true } } } },
          barbeiro: { include: { usuario: { select: { nome: true } } } },
          servico: { select: { nome: true, duracaoMinutos: true } },
        }
      });

      const { HorariosUtil, injetarDuracaoTotalServicos } = require('./horarios.util');
      const agendamentosTratados = await injetarDuracaoTotalServicos(agendamentosFuturos);

      for (const ag of agendamentosTratados) {
        try {
          await HorariosUtil.validarDentroDoFuncionamento({
            barbeariaId: ag.barbeariaId,
            barbeiroId: ag.barbeiroId,
            dataHora: ag.dataHora,
            duracaoMinutos: (ag as any).duracaoTotal || ag.servico?.duracaoMinutos || 0
          });
        } catch (error: any) {
          conflitosGerados.push({
            id: ag.id,
            dataHora: ag.dataHora,
            cliente: ag.cliente?.usuario?.nome,
            barbeiro: ag.barbeiro?.usuario?.nome,
            servico: ag.servico?.nome,
            status: ag.status,
            motivo: error.message
          });
        }
      }
    }

    return { ...updated, conflitosGerados };
  }
}
