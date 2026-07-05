import { ConfiguracaoService } from './configuracao.service';
import {
  criarDataHoraBrasilia,
  formatarHorario,
  getHoraMinutoBrasilia,
} from '../lib/timezone';

export interface DiaConfig {
  fechado: boolean;
  abertura?: string;
  fechamento?: string;
  temAlmoco?: boolean;
  almocoInicio?: string;
  almocoFim?: string;
}

export class HorariosUtil {
  /** Retorna a configuração do dia da semana (domingo a sabado) para a data informada */
  static async getConfigDia(barbeariaId: string | null | undefined, dataStr: string): Promise<DiaConfig> {
    const config = await ConfiguracaoService.obter(barbeariaId);
    const horarios = (config.horariosFuncionamento as any) || {};

    const [ano, mes, dia] = dataStr.split('-').map(Number);
    const dataRef = new Date(ano, mes - 1, dia); 
    const diasSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const diaSemanaNome = diasSemana[dataRef.getDay()];

    const configDia = horarios[diaSemanaNome];
    if (!configDia) {
      return { fechado: true };
    }
    return configDia;
  }

  /** Valida se um horário e duração específicos estão dentro do expediente e não cruzam o almoço */
  static async validarDentroDoFuncionamento(params: {
    barbeariaId: string | null | undefined;
    dataHora: Date;
    duracaoMinutos: number;
  }): Promise<void> {
    // toBrasiliaDate converts to UTC date that visually matches Brasilia time.
    const ano = params.dataHora.getUTCFullYear();
    const mes = String(params.dataHora.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(params.dataHora.getUTCDate()).padStart(2, '0');
    const dataSimples = `${ano}-${mes}-${dia}`;

    const configDia = await this.getConfigDia(params.barbeariaId, dataSimples);
    if (configDia.fechado) {
      throw new Error('A barbearia está fechada neste dia.');
    }

    const { hora, minuto } = getHoraMinutoBrasilia(params.dataHora);
    const inicioM = hora * 60 + minuto;
    const fimM = inicioM + params.duracaoMinutos;

    const [abHora, abMin] = (configDia.abertura || '00:00').split(':').map(Number);
    const [fecHora, fecMin] = (configDia.fechamento || '23:59').split(':').map(Number);
    const aberturaM = abHora * 60 + abMin;
    const fechamentoM = fecHora * 60 + fecMin;

    if (inicioM < aberturaM) {
      throw new Error(`Horário antes da abertura (${configDia.abertura}).`);
    }
    if (fimM > fechamentoM) {
      throw new Error(`O serviço excede o horário de fechamento (${configDia.fechamento}).`);
    }

    if (configDia.temAlmoco && configDia.almocoInicio && configDia.almocoFim) {
      const [aiHora, aiMin] = configDia.almocoInicio.split(':').map(Number);
      const [afHora, afMin] = configDia.almocoFim.split(':').map(Number);
      const almocoInicioM = aiHora * 60 + aiMin;
      const almocoFimM = afHora * 60 + afMin;

      // Intersecção: inicio1 < fim2 && fim1 > inicio2
      if (inicioM < almocoFimM && fimM > almocoInicioM) {
        throw new Error(`Horário sobrepõe o intervalo de almoço (${configDia.almocoInicio} - ${configDia.almocoFim}).`);
      }
    }
  }

  /** Gera slots cobrindo o expediente, detalhando disponibilidade, agendamentos e bloqueios */
  static gerarSlotsDisponiveis(params: {
    dataStr: string;
    configDia: DiaConfig;
    duracaoMinutos: number;
    agendamentos: Array<any>;
    bloqueios: Array<any>;
  }): Array<{ horario: string; disponivel: boolean; ocupado?: boolean; agendamentoId?: string; bloqueado?: boolean; motivoBloqueio?: string | null }> {
    if (params.configDia.fechado) {
      return [];
    }

    const [aberturaHora, aberturaMin] = (params.configDia.abertura || '00:00').split(':').map(Number);
    const [fechamentoHora, fechamentoMin] = (params.configDia.fechamento || '23:59').split(':').map(Number);

    const inicioMinutos = aberturaHora * 60 + aberturaMin;
    const fimMinutos = fechamentoHora * 60 + fechamentoMin;

    let almocoInicioM = -1;
    let almocoFimM = -1;
    if (params.configDia.temAlmoco && params.configDia.almocoInicio && params.configDia.almocoFim) {
      const [aiHora, aiMin] = params.configDia.almocoInicio.split(':').map(Number);
      const [afHora, afMin] = params.configDia.almocoFim.split(':').map(Number);
      almocoInicioM = aiHora * 60 + aiMin;
      almocoFimM = afHora * 60 + afMin;
    }

    const agora = new Date();
    const slots: Array<{ horario: string; disponivel: boolean; ocupado?: boolean; agendamentoId?: string; bloqueado?: boolean; motivoBloqueio?: string | null }> = [];

    // O gerador base será de 30 em 30 min (padrão)
    // Para verificação correta de disponibilidade, avaliamos duracaoMinutos.
    // NOTA: Em visualizações de agenda diária (agendamento.service), duracaoMinutos costuma vir como 30 para preencher a grade.
    for (let m = inicioMinutos; m + params.duracaoMinutos <= fimMinutos; m += 30) {
      const horaSlot = Math.floor(m / 60);
      const minSlot = m % 60;

      const slotInicioDate = criarDataHoraBrasilia(params.dataStr, horaSlot, minSlot);
      
      const slotInicioM = m;
      const slotFimM = m + params.duracaoMinutos;

      let noAlmoco = false;
      // Cruza almoço?
      if (params.configDia.temAlmoco && slotInicioM < almocoFimM && slotFimM > almocoInicioM) {
        noAlmoco = true;
      }

      const slotFimDate = new Date(slotInicioDate.getTime() + params.duracaoMinutos * 60000);

      // Conflito agendamentos
      const agendamentoConflitante = params.agendamentos.find(ag => {
        const agDate = new Date(ag.dataHora);
        const agHM = getHoraMinutoBrasilia(agDate);
        const agInicioM = agHM.hora * 60 + agHM.minuto;
        const agFimM = agInicioM + (ag.servico?.duracaoMinutos || 30);
        return slotInicioM < agFimM && slotFimM > agInicioM;
      });

      // Conflito bloqueios
      const bloqueioConflitante = params.bloqueios.find(bl => {
        return slotInicioDate < new Date(bl.dataFim) && slotFimDate > new Date(bl.dataInicio);
      });

      const disponivel = !noAlmoco && !agendamentoConflitante && !bloqueioConflitante && (slotInicioDate >= agora);

      // Se for apenas para pular o almoço na exibição, não adicionamos. 
      // Mas se quisermos exibir o slot do almoço como indisponível, podemos.
      // O padrão anterior pulava o almoço (continue). Vamos manter isso para não poluir a agenda com horários que não existem.
      if (noAlmoco) {
        continue;
      }

      slots.push({
        horario: formatarHorario(horaSlot, minSlot),
        disponivel,
        ocupado: !!agendamentoConflitante || !!bloqueioConflitante,
        agendamentoId: agendamentoConflitante?.id,
        bloqueado: !!bloqueioConflitante,
        motivoBloqueio: bloqueioConflitante?.motivo
      });
    }

    return slots;
  }
}
