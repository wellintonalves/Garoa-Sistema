// Controller do app do barbeiro
import { Response } from 'express';
import { BarbeiroAppService } from '../services/barbeiroApp.service';
import { BarbeiroAuthRequest } from '../types';
import { Request } from 'express';

export class BarbeiroAppController {
  /** POST /barbeiro/login */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, senha } = req.body;

      if (!email || !senha) {
        res.status(400).json({ erro: 'Email e senha são obrigatórios' });
        return;
      }

      const resultado = await BarbeiroAppService.login(email, senha);
      res.json(resultado);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao fazer login';
      res.status(401).json({ erro: mensagem });
    }
  }

  /** GET /barbeiro/agenda-hoje */
  static async agendaHoje(req: BarbeiroAuthRequest, res: Response): Promise<void> {
    try {
      const barbeiro = req.barbeiro;
      if (!barbeiro) { res.status(401).json({ erro: 'Não autorizado' }); return; }

      const agendamentos = await BarbeiroAppService.agendaHoje(barbeiro.barbeiroId, barbeiro.barbeariaId);
      res.json(agendamentos);
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao buscar agenda' });
    }
  }

  /** GET /barbeiro/agenda?data= */
  static async agenda(req: BarbeiroAuthRequest, res: Response): Promise<void> {
    try {
      const barbeiro = req.barbeiro;
      if (!barbeiro) { res.status(401).json({ erro: 'Não autorizado' }); return; }

      const data = req.query.data as string;
      if (!data) {
        res.status(400).json({ erro: 'Parâmetro data é obrigatório' });
        return;
      }

      const agendamentos = await BarbeiroAppService.agendaPorData(barbeiro.barbeiroId, barbeiro.barbeariaId, data);
      res.json(agendamentos);
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao buscar agenda' });
    }
  }

  /** GET /barbeiro/comissoes?inicio=&fim= */
  static async comissoes(req: BarbeiroAuthRequest, res: Response): Promise<void> {
    try {
      const barbeiro = req.barbeiro;
      if (!barbeiro) { res.status(401).json({ erro: 'Não autorizado' }); return; }

      const { inicio, fim } = req.query;
      if (!inicio || !fim) {
        res.status(400).json({ erro: 'Parâmetros inicio e fim são obrigatórios' });
        return;
      }

      const comissoes = await BarbeiroAppService.comissoes(
        barbeiro.barbeiroId,
        barbeiro.barbeariaId,
        inicio as string,
        fim as string
      );
      res.json(comissoes);
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao buscar comissões' });
    }
  }

  /** POST /barbeiro/concluir-agendamento/:id */
  static async concluirAgendamento(req: BarbeiroAuthRequest, res: Response): Promise<void> {
    try {
      const barbeiro = req.barbeiro;
      if (!barbeiro) { res.status(401).json({ erro: 'Não autorizado' }); return; }

      const { formaPagamento } = req.body;
      if (!formaPagamento) {
        res.status(400).json({ erro: 'Forma de pagamento é obrigatória' });
        return;
      }

      const resultado = await BarbeiroAppService.concluirAgendamento(
        req.params.id,
        barbeiro.barbeiroId,
        barbeiro.barbeariaId,
        formaPagamento
      );
      res.json(resultado);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao concluir agendamento';
      res.status(400).json({ erro: msg });
    }
  }

  /** GET /barbeiro/perfil */
  static async perfil(req: BarbeiroAuthRequest, res: Response): Promise<void> {
    try {
      const barbeiro = req.barbeiro;
      if (!barbeiro) { res.status(401).json({ erro: 'Não autorizado' }); return; }

      const perfil = await BarbeiroAppService.perfil(barbeiro.barbeiroId);
      res.json(perfil);
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao buscar perfil' });
    }
  }

  /** PATCH /barbeiro/status-trabalho */
  static async atualizarStatusTrabalho(req: BarbeiroAuthRequest, res: Response): Promise<void> {
    try {
      const barbeiro = req.barbeiro;
      if (!barbeiro) { res.status(401).json({ erro: 'Não autorizado' }); return; }

      const { trabalhandoAgora } = req.body;
      const { prisma } = require('../lib/prisma');
      
      const atualizado = await prisma.barbeiro.update({
        where: { id: barbeiro.barbeiroId },
        data: { trabalhandoAgora: Boolean(trabalhandoAgora) },
      });

      res.json({ trabalhandoAgora: atualizado.trabalhandoAgora });
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao atualizar status' });
    }
  }
}
