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
import { HorariosUtil, injetarDuracaoTotalServicos } from '../services/horarios.util';

export class PublicoController {
  /** GET /publico/barbearia/slug/:slug */
  static async buscarBarbeariaPorSlug(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const barbearia = await prisma.barbearia.findUnique({
        where: { slug: slug as string },
        select: {
          id: true,
          nome: true,
          slug: true,
          logo: true,
          endereco: true,
        },
      });

      if (!barbearia) {
        res.status(404).json({ erro: 'Barbearia não encontrada' });
        return;
      }

      res.json(barbearia);
    } catch (error) {
      console.error(error);
      res.status(500).json({ erro: 'Erro ao buscar barbearia' });
    }
  }
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

      const barbearia = await prisma.barbearia.findFirst();

      const servico = await prisma.servico.findUnique({ where: { id: servicoId as string } });
      if (!servico) {
        res.status(404).json({ erro: 'Serviço não encontrado' });
        return;
      }

      const duracaoTotal = servico.duracaoMinutos;

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

      const barbeirosAtivos = await prisma.barbeiro.findMany({ where: { ativo: true } });
      if (barbeirosAtivos.length === 0) {
        res.json([]);
        return;
      }

      const barbeirosAlvo = (barbeiroId && barbeiroId !== 'sem_preferencia') 
        ? [{ id: barbeiroId as string }] 
        : barbeirosAtivos;

      const horariosLivresSet = new Set<string>();

      for (const barb of barbeirosAlvo) {
         const agendamentosDoBarbeiro = agendamentosExistentes.filter(ag => ag.barbeiroId === barb.id);
         const bloqueiosDoBarbeiro = await prisma.bloqueioAgenda.findMany({
            where: {
              barbeiroId: barb.id,
              dataInicio: { lte: dataFimDia },
              dataFim: { gte: dataInicioDia }
            }
         });
         
         const configDiaBarbeiro = await HorariosUtil.getConfigDia(barbearia?.id, dataStr, barb.id);
         if (configDiaBarbeiro.fechado) continue;

         const slots = HorariosUtil.gerarSlotsDisponiveis({
           dataStr,
           configDia: configDiaBarbeiro,
           duracaoMinutos: duracaoTotal,
           agendamentos: agendamentosDoBarbeiro,
           bloqueios: bloqueiosDoBarbeiro
         });

         for (const s of slots) {
           if (s.disponivel) horariosLivresSet.add(s.horario);
         }
      }

      const horariosLivres = Array.from(horariosLivresSet).sort();
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
          let agendamentosDia = await prisma.agendamento.findMany({
            where: {
              barbeiroId: barb.id,
              status: { notIn: ['CANCELADO', 'CONCLUIDO'] },
              dataHora: { gte: dataInicioDia, lte: dataFimDia },
            },
            include: { servico: true }
          });

          agendamentosDia = await injetarDuracaoTotalServicos(agendamentosDia);

          const conflito = agendamentosDia.some(ag => {
            const agHM = getHoraMinutoBrasilia(new Date(ag.dataHora));
            const agInicioM = agHM.hora * 60 + agHM.minuto;
            const agFimM = agInicioM + (ag.servico?.duracaoMinutos ?? 0);
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

      await HorariosUtil.validarConflitoCliente({
        clienteId: cliente.id,
        dataHora: dataHoraBrasilia,
        duracaoMinutos: servico.duracaoMinutos
      });

      const agendamento = await prisma.agendamento.create({
        data: {
          clienteId: cliente.id,
          barbeariaId: servico.barbeariaId,
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
          servico: h.servico?.nome || 'Serviço',
          barbeiro: h.barbeiro.usuario.nome
        }))
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({ erro: 'Erro ao checar fidelidade' });
    }
  }
}
