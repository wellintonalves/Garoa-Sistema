import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ConfiguracaoService } from '../services/configuracao.service';
import {
  toBrasiliaDate,
  inicioDiaBrasilia,
  fimDiaBrasilia,
  getHoraMinutoBrasilia,
  criarDataHoraBrasilia,
  formatarHorario,
} from '../lib/timezone';

export class PublicoController {
  /** GET /publico/servicos */
  static async listarServicos(_req: Request, res: Response): Promise<void> {
    try {
      const servicos = await prisma.servico.findMany({
        where: { ativo: true },
      });
      res.json(servicos);
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao listar serviços' });
    }
  }

  /** GET /publico/barbeiros */
  static async listarBarbeiros(_req: Request, res: Response): Promise<void> {
    try {
      const barbeiros = await prisma.barbeiro.findMany({
        where: { ativo: true },
        include: { usuario: { select: { nome: true } } },
      });
      res.json(barbeiros);
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao listar barbeiros' });
    }
  }

  /** GET /publico/horarios-disponiveis?barbeiroId=&data=&servicoId= */
  static async listarHorariosDisponiveis(req: Request, res: Response): Promise<void> {
    try {
      const { barbeiroId, data, servicoId } = req.query;
      if (!data || !servicoId) {
        res.status(400).json({ erro: 'Parâmetros data e servicoId são obrigatórios' });
        return;
      }

      const dataStr = data as string;
      const dateObj = inicioDiaBrasilia(dataStr);
      if (isNaN(dateObj.getTime())) {
        res.status(400).json({ erro: 'Data inválida' });
        return;
      }

      const config = await ConfiguracaoService.obter();
      const horariosFuncionamento = config.horariosFuncionamento as any;
      
      // Calcula o dia da semana baseado na data em Brasília
      const { hora: horaCheck } = getHoraMinutoBrasilia(dateObj);
      const diasSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
      const diaAtual = diasSemana[dateObj.getDay()];
      
      const configDia = horariosFuncionamento[diaAtual];
      if (!configDia || configDia.fechado) {
        res.json([]);
        return;
      }

      const servico = await prisma.servico.findUnique({ where: { id: servicoId as string } });
      if (!servico) {
        res.status(404).json({ erro: 'Serviço não encontrado' });
        return;
      }

      const duracaoTotal = servico.duracaoMinutos;

      // Buscar agendamentos do dia com range de Brasília
      const dataInicioDia = inicioDiaBrasilia(dataStr);
      const dataFimDia = fimDiaBrasilia(dataStr);

      let whereBarbeiro = {};
      if (barbeiroId && barbeiroId !== 'sem_preferencia') {
        whereBarbeiro = { barbeiroId: barbeiroId as string };
      }

      const agendamentosExistentes = await prisma.agendamento.findMany({
        where: {
          dataHora: { gte: dataInicioDia, lte: dataFimDia },
          status: { notIn: ['CANCELADO', 'CONCLUIDO'] },
          ...whereBarbeiro
        },
        include: { servico: true }
      });

      // Se "sem_preferencia", precisamos garantir que existe pelo menos um barbeiro disponivel para o horario
      const barbeirosAtivos = await prisma.barbeiro.findMany({ where: { ativo: true } });
      if (barbeirosAtivos.length === 0) {
        res.json([]);
        return;
      }

      // Busca dados de almoço da barbearia
      const barbearia = await prisma.barbearia.findFirst();
      const temAlmoco = barbearia?.temAlmoco || false;
      const almocoInicio = barbearia?.horarioAlmocoInicio || '12:00';
      const almocoFim = barbearia?.horarioAlmocoFim || '13:00';
      const almocoInicioMin = parseInt(almocoInicio.split(':')[0]) * 60 + parseInt(almocoInicio.split(':')[1]);
      const almocoFimMin = parseInt(almocoFim.split(':')[0]) * 60 + parseInt(almocoFim.split(':')[1]);

      const { abertura, fechamento } = configDia;
      const [aberturaHora, aberturaMin] = abertura.split(':').map(Number);
      const [fechamentoHora, fechamentoMin] = fechamento.split(':').map(Number);

      const inicioMinutos = aberturaHora * 60 + aberturaMin;
      const fimMinutos = fechamentoHora * 60 + fechamentoMin;

      const horariosLivres: string[] = [];
      const agora = new Date();

      // Iterar de 30 em 30 minutos
      for (let m = inicioMinutos; m + duracaoTotal <= fimMinutos; m += 30) {
        const horaSlot = Math.floor(m / 60);
        const minSlot = m % 60;

        // Pula horário de almoço
        if (temAlmoco && m >= almocoInicioMin && m < almocoFimMin) {
          continue;
        }
        
        // Verifica se é no passado (usando fuso de Brasília)
        const slotDate = criarDataHoraBrasilia(dataStr, horaSlot, minSlot);
        if (slotDate < agora) {
          continue;
        }

        const slotInicioM = m;
        const slotFimM = m + duracaoTotal;

        // Se barbeiro especifico, checa os agendamentos dele
        if (barbeiroId && barbeiroId !== 'sem_preferencia') {
          const conflito = agendamentosExistentes.some(ag => {
            const agHM = getHoraMinutoBrasilia(new Date(ag.dataHora));
            const agInicioM = agHM.hora * 60 + agHM.minuto;
            const agFimM = agInicioM + ag.servico.duracaoMinutos;
            // Intersecção de intervalos: inicio1 < fim2 && fim1 > inicio2
            return slotInicioM < agFimM && slotFimM > agInicioM;
          });

          if (!conflito) {
            horariosLivres.push(formatarHorario(horaSlot, minSlot));
          }
        } else {
          // Sem preferencia: checa se PELO MENOS UM barbeiro está livre
          let algumBarbeiroLivre = false;
          for (const barb of barbeirosAtivos) {
            const agsDoBarbeiro = agendamentosExistentes.filter(ag => ag.barbeiroId === barb.id);
            const conflito = agsDoBarbeiro.some(ag => {
              const agHM = getHoraMinutoBrasilia(new Date(ag.dataHora));
              const agInicioM = agHM.hora * 60 + agHM.minuto;
              const agFimM = agInicioM + ag.servico.duracaoMinutos;
              return slotInicioM < agFimM && slotFimM > agInicioM;
            });
            if (!conflito) {
              algumBarbeiroLivre = true;
              break;
            }
          }

          if (algumBarbeiroLivre) {
            horariosLivres.push(formatarHorario(horaSlot, minSlot));
          }
        }
      }

      res.json(horariosLivres);
    } catch (error) {
      console.error(error);
      res.status(500).json({ erro: 'Erro ao calcular horários' });
    }
  }

  /** POST /publico/agendamentos */
  static async criarAgendamento(req: Request, res: Response): Promise<void> {
    try {
      const { nomeCliente, telefoneCliente, barbeiroId, servicoId, dataHora, observacoes } = req.body;

      if (!nomeCliente || !telefoneCliente || !servicoId || !dataHora) {
        res.status(400).json({ erro: 'Dados incompletos' });
        return;
      }

      const servico = await prisma.servico.findUnique({ where: { id: servicoId } });
      if (!servico) {
        res.status(404).json({ erro: 'Serviço não encontrado' });
        return;
      }

      // Procura ou cria o cliente pelo telefone
      let cliente = await prisma.cliente.findFirst({
        where: { telefone: telefoneCliente },
      });

      if (!cliente) {
        // Como o Cliente requer um Usuario, criamos o usuario primeiro
        const usuario = await prisma.usuario.create({
          data: {
            nome: nomeCliente,
            email: `cliente_${telefoneCliente}@garoa.com.br`, // email fake pra satisfazer unique
            senha: 'NO_PASSWORD',
            papel: 'CLIENTE',
          } as any
        });

        cliente = await prisma.cliente.create({
          data: {
            usuarioId: usuario.id,
            telefone: telefoneCliente,
          } as any
        });
      }

      // Se não enviou barbeiro (sem preferencia), precisamos achar um livre
      let barbeiroFinalId = barbeiroId;
      if (!barbeiroFinalId || barbeiroFinalId === 'sem_preferencia') {
        const barbeirosAtivos = await prisma.barbeiro.findMany({ where: { ativo: true } });
        
        const dataHoraBrasilia = toBrasiliaDate(dataHora);
        const { hora, minuto } = getHoraMinutoBrasilia(dataHoraBrasilia);
        const slotInicioM = hora * 60 + minuto;
        const slotFimM = slotInicioM + servico.duracaoMinutos;

        const dataStr = dataHora.split('T')[0];
        const dataInicioDia = inicioDiaBrasilia(dataStr);
        const dataFimDia = fimDiaBrasilia(dataStr);

        for (const barb of barbeirosAtivos) {
          // Checar conflito
          const agendamentosDia = await prisma.agendamento.findMany({
            where: {
              barbeiroId: barb.id,
              status: { notIn: ['CANCELADO', 'CONCLUIDO'] },
              dataHora: { gte: dataInicioDia, lte: dataFimDia },
            },
            include: { servico: true }
          });

          const conflito = agendamentosDia.some(ag => {
            const agHM = getHoraMinutoBrasilia(new Date(ag.dataHora));
            const agInicioM = agHM.hora * 60 + agHM.minuto;
            const agFimM = agInicioM + ag.servico.duracaoMinutos;
            return slotInicioM < agFimM && slotFimM > agInicioM;
          });

          if (!conflito) {
            barbeiroFinalId = barb.id;
            break;
          }
        }

        // Se nenhum barbeiro livre, pega o primeiro (fallback)
        if (!barbeiroFinalId || barbeiroFinalId === 'sem_preferencia') {
          if (barbeirosAtivos.length > 0) {
            barbeiroFinalId = barbeirosAtivos[0].id;
          }
        }
      }

      // Converte para horário de Brasília
      const dataHoraBrasilia = toBrasiliaDate(dataHora);

      const agendamento = await prisma.agendamento.create({
        data: {
          clienteId: cliente.id,
          barbeiroId: barbeiroFinalId,
          servicoId: servico.id,
          dataHora: dataHoraBrasilia,
          observacoes,
          valorCobrado: servico.preco,
          origem: 'ONLINE',
          status: 'CONFIRMADO', // Public appointments auto-confirmed
        } as any
      });

      res.status(201).json(agendamento);
    } catch (error) {
      console.error(error);
      res.status(500).json({ erro: 'Erro ao criar agendamento' });
    }
  }

  /** GET /publico/fidelidade?telefone= */
  static async checarFidelidade(req: Request, res: Response): Promise<void> {
    try {
      const { telefone } = req.query;
      if (!telefone) {
        res.status(400).json({ erro: 'Telefone é obrigatório' });
        return;
      }

      const cliente = await prisma.cliente.findFirst({
        where: { telefone: telefone as string },
        include: { usuario: { select: { nome: true } } }
      });

      if (!cliente) {
        res.status(404).json({ erro: 'Cliente não encontrado' });
        return;
      }

      // Historico de visitas concluidas
      const historico = await prisma.agendamento.findMany({
        where: { 
          clienteId: cliente.id,
          status: 'CONCLUIDO'
        },
        include: { servico: true, barbeiro: { include: { usuario: true } } },
        orderBy: { dataHora: 'desc' }
      });

      const config = await ConfiguracaoService.obter();
      const regras = config.regrasFidelidade as any;
      const meta = regras?.pontosParaRecompensa || 10;

      const pontosAcumulados = historico.length;
      const pontosFaltantes = Math.max(0, meta - (pontosAcumulados % meta));

      res.json({
        cliente: cliente.usuario.nome,
        pontosAcumulados,
        meta,
        pontosFaltantes,
        historico: historico.slice(0, 10).map(h => ({
          data: h.dataHora,
          servico: h.servico.nome,
          barbeiro: h.barbeiro.usuario.nome
        }))
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({ erro: 'Erro ao checar fidelidade' });
    }
  }
}
