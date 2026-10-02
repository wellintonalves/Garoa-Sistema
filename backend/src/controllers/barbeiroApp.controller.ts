import { iniciarSessao } from '../services/sessao.service';
// Controller do app do barbeiro
import { BarbeiroAppService } from '../services/barbeiroApp.service';
import { BarbeiroAuthRequest } from '../types';
import { Request, Response, NextFunction } from 'express';
import { SupabaseService } from '../services/supabase.service';

export class BarbeiroAppController {
  /** POST /barbeiro/login */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, senha, barbeariaId } = req.body;

      if (!email || !senha) {
        res.status(400).json({ erro: 'Email e senha são obrigatórios' });
        return;
      }

      const resultado = await BarbeiroAppService.login(email, senha, barbeariaId);
      const tokenPonte = await iniciarSessao(req, res, resultado.barbeiro.usuarioId, 'barbeiro');
      res.json({ ...resultado, ...(tokenPonte ? { token: tokenPonte } : {}) });
    } catch (error: any) {
      if (error?.codigo === 'ESCOLHER_BARBEARIA') {
        res.status(409).json({
          erro: error.message,
          codigo: 'ESCOLHER_BARBEARIA',
          barbearias: error.barbearias,
        });
        return;
      }
      next(error);
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

      const { formaPagamento, pontosUsados, descontoPercentual, descontoReais } = req.body;
      if (!formaPagamento) {
        res.status(400).json({ erro: 'Forma de pagamento é obrigatória' });
        return;
      }

      const resultado = await BarbeiroAppService.concluirAgendamento(
        req.params.id,
        barbeiro.barbeiroId,
        barbeiro.barbeariaId,
        formaPagamento,
        pontosUsados,
        descontoPercentual,
        descontoReais
      );
      res.json(resultado);
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : 'Erro ao concluir agendamento';
      const status = error.status || 400;
      res.status(status).json({ erro: msg });
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

  /** PUT /barbeiro/perfil */
  static async atualizarPerfil(req: BarbeiroAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const barbeiro = req.barbeiro;
      if (!barbeiro) { res.status(401).json({ erro: 'Não autorizado' }); return; }

      const dados = req.body;
      const atualizado = await BarbeiroAppService.atualizarPerfil(barbeiro.barbeiroId, dados);
      res.json(atualizado);
    } catch (error) { next(error); }
  }

  /** POST /barbeiro/foto */
  static async uploadFoto(req: BarbeiroAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const barbeiro = req.barbeiro;
      if (!barbeiro) { res.status(401).json({ erro: 'Não autorizado' }); return; }

      if (!req.file) {
        res.status(400).json({ erro: 'Nenhuma imagem enviada' });
        return;
      }

      const url = await SupabaseService.uploadImage('barbeiros', {
        barbeariaId: barbeiro.barbeariaId, usuarioId: barbeiro.usuarioId, papel: 'BARBEIRO', barbeiroId: barbeiro.barbeiroId,
      }, req.file.buffer, req.file.mimetype);
      
      res.json({ url });
    } catch (error) {
      next(error);
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

  /** GET /barbeiro/resumo-semana */
  static async resumoSemana(req: BarbeiroAuthRequest, res: Response): Promise<void> {
    try {
      const barbeiro = req.barbeiro;
      if (!barbeiro) { res.status(401).json({ erro: 'Não autorizado' }); return; }

      const resumo = await BarbeiroAppService.resumoSemana(barbeiro.barbeiroId, barbeiro.barbeariaId);
      res.json(resumo);
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao buscar resumo' });
    }
  }
}
