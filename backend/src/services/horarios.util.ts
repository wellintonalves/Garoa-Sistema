import { ConfiguracaoService } from './configuracao.service';
import {
  criarDataHoraBrasilia,
  formatarHorario,
  getHoraMinutoBrasilia,
  inicioDiaBrasilia,
  fimDiaBrasilia,
  diaBrasiliaStr,
} from '../lib/timezone';

export async function injetarDuracaoTotalServicos(agendamentos: any[]) {
  if (!agendamentos || agendamentos.length === 0) return agendamentos;
  const { prisma } = require('../lib/prisma');
  const servicosIdsSet = new Set<string>();
  for (const ag of agendamentos) {
    if (ag.servicosIds && ag.servicosIds.length > 0) {
      ag.servicosIds.forEach((id: string) => servicosIdsSet.add(id));
    } else if (ag.servicoId) {
      servicosIdsSet.add(ag.servicoId);
    }
  }
  if (servicosIdsSet.size === 0) return agendamentos;
  
  const servicos = await prisma.servico.findMany({
    where: { id: { in: Array.from(servicosIdsSet) } },
    select: { id: true, duracaoMinutos: true, nome: true, preco: true }
  });
  const mapa = Object.fromEntries(servicos.map((s: any) => [s.id, s]));
  
  for (const ag of agendamentos) {
    if (ag.servico) {
      let duracaoTotal = 0;
      let nomeFinal = ag.servico.nome;
      let servicosAdicionais: any[] = [];
      
      if (ag.servicosIds && ag.servicosIds.length > 0) {
        duracaoTotal = ag.servicosIds.reduce((sum: number, id: string) => sum + (mapa[id]?.duracaoMinutos || 0), 0);
        nomeFinal = ag.servicosIds.map((id: string) => mapa[id]?.nome).filter(Boolean).join(' + ');
        servicosAdicionais = ag.servicosIds.map((id: string) => mapa[id]).filter(Boolean);
      } else {
        duracaoTotal = ag.servico.duracaoMinutos || 0;
        servicosAdicionais = [mapa[ag.servicoId] || ag.servico];
      }
      ag.servico.duracaoMinutos = duracaoTotal;
      ag.servico.nome = nomeFinal;
      ag.servicosAdicionais = servicosAdicionais;
    }
  }
  return agendamentos;
}

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
  static async getConfigDia(barbeariaId: string | null | undefined, dataStr: string, barbeiroId?: string | null): Promise<DiaConfig> {
    const [ano, mes, dia] = dataStr.split('-').map(Number);
    const dataRef = new Date(ano, mes - 1, dia); 
    const diasSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const diaSemanaNome = diasSemana[dataRef.getDay()];

    if (barbeiroId) {
      const { prisma } = require('../lib/prisma');
      const barbeiro = await prisma.barbeiro.findUnique({ where: { id: barbeiroId } });
      if (barbeiro && barbeiro.horariosTrabalho) {
        const horariosBarbeiro = barbeiro.horariosTrabalho as any;
        if (horariosBarbeiro[diaSemanaNome]) {
           return horariosBarbeiro[diaSemanaNome];
        }
      }
    }

    const config = await ConfiguracaoService.obter(barbeariaId);
    const horarios = (config.horariosFuncionamento as any) || {};

    const configDia = horarios[diaSemanaNome];
    if (!configDia) {
      return { fechado: true };
    }
    return configDia;
  }

  /** Valida se um horário e duração específicos estão dentro do expediente e não cruzam o almoço */
  static async validarDentroDoFuncionamento(params: {
    barbeariaId: string | null | undefined;
    barbeiroId?: string | null;
    dataHora: Date;
    duracaoMinutos: number;
  }): Promise<void> {
    // Usa diaBrasiliaStr para garantir a data local correta
    const dataSimples = diaBrasiliaStr(params.dataHora);

    const configDia = await this.getConfigDia(params.barbeariaId, dataSimples, params.barbeiroId);
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

  /** Valida se o cliente já possui um agendamento conflitante no mesmo horário (inclusive com outro barbeiro) */
  static async validarConflitoCliente(params: {
    clienteId: string;
    dataHora: Date;
    duracaoMinutos: number;
    ignorarAgendamentoId?: string;
  }): Promise<void> {
    const { prisma } = require('../lib/prisma');
    
    // Usa diaBrasiliaStr para garantir a data local correta
    const dataStr = diaBrasiliaStr(params.dataHora);
    
    const dataInicioDia = inicioDiaBrasilia(dataStr);
    const dataFimDia = fimDiaBrasilia(dataStr);

    let agendamentosCliente = await prisma.agendamento.findMany({
      where: {
        clienteId: params.clienteId,
        status: { in: ['AGUARDANDO', 'CONFIRMADO', 'CONCLUIDO'] },
        dataHora: { gte: dataInicioDia, lte: dataFimDia },
        id: params.ignorarAgendamentoId ? { not: params.ignorarAgendamentoId } : undefined
      },
      include: { servico: true, barbeiro: { include: { usuario: true } } }
    });

    agendamentosCliente = await injetarDuracaoTotalServicos(agendamentosCliente);

    const reqInicioM = params.dataHora.getTime();
    const reqFimM = reqInicioM + (Number(params.duracaoMinutos) * 60000);

    for (const ag of agendamentosCliente) {
      const agDate = new Date(ag.dataHora);
      const agInicioM = agDate.getTime();
      const agFimM = agInicioM + ((ag.servico?.duracaoMinutos || 0) * 60000);
      
      const conflita = (reqInicioM < agFimM) && (agInicioM < reqFimM);
      
      console.log(`[CONFLITO CHECK] Req: ${reqInicioM} - ${reqFimM} | Ag: ${agInicioM} - ${agFimM} | Conflita: ${conflita} | params.duracao: ${params.duracaoMinutos} | ag.duracao: ${ag.servico?.duracaoMinutos}`);

      if (conflita) {
        const nomeBarbeiro = ag.barbeiro?.usuario?.nome || 'outro barbeiro';
        const nomeServico = ag.servico?.nome || 'um serviço';
        
        const erro: any = new Error(`Você já tem um agendamento de ${nomeServico} com ${nomeBarbeiro} que conflita com este horário. Escolha outro horário.`);
        erro.status = 409;
        throw erro;
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
    agendamentosCliente?: Array<any>;
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
        
        const agDuracao = ag.itens && ag.itens.length > 0 
          ? ag.itens.reduce((acc: number, item: any) => acc + item.duracaoMinutos, 0)
          : (ag.servico?.duracaoMinutos || 30);
          
        const agFimM = agInicioM + agDuracao;
        return slotInicioM < agFimM && slotFimM > agInicioM;
      });

      // Conflito com agendamentos paralelos do mesmo cliente
      let conflitoCliente = false;
      if (params.agendamentosCliente && params.agendamentosCliente.length > 0) {
        conflitoCliente = params.agendamentosCliente.some(ag => {
          const agDate = new Date(ag.dataHora);
          // Converter dataHora do agendamento do cliente para minutos locais para comparar de forma justa
          const agHM = getHoraMinutoBrasilia(agDate);
          const agInicioM = agHM.hora * 60 + agHM.minuto;
          const agFimM = agInicioM + (ag.servico?.duracaoMinutos || 0);
          return slotInicioM < agFimM && slotFimM > agInicioM;
        });
      }

      // Se o cliente tem conflito no horário, não oferecemos o slot (ele não existe para ele)
      if (conflitoCliente) {
        continue;
      }

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
