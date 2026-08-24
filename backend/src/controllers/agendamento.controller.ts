// Controller de agendamentos
import { Response } from 'express';
import { AgendamentoService } from '../services/agendamento.service';
import { diaBrasiliaStr } from '../lib/timezone';
import { AuthRequest } from '../types';

export class AgendamentoController {
  /** GET /agendamentos */
  static async listar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { barbeiroId, data, dataInicio, dataFim, status } = req.query;

      // Se for barbeiro, só vê os próprios
      let filtroBarb = barbeiroId as string | undefined;
      if (req.usuario?.papel === 'BARBEIRO') {
        const { BarbeiroService } = await import('../services/barbeiro.service');
        const barbeiro = await BarbeiroService.buscarPorUsuarioId(req.usuario.id);
        if (barbeiro) filtroBarb = barbeiro.id;
      }

      const agendamentos = await AgendamentoService.listarTodos({
        barbeiroId: filtroBarb,
        data: data as string,
        dataInicio: dataInicio as string,
        dataFim: dataFim as string,
        status: status as 'AGUARDANDO' | 'CONFIRMADO' | 'CONCLUIDO' | 'CANCELADO',
      });
      res.json(agendamentos);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao listar agendamentos';
      res.status(500).json({ erro: msg });
    }
  }

  /** GET /agendamentos/:id */
  static async buscar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const agendamento = await AgendamentoService.buscarPorId(req.params.id);
      res.json(agendamento);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao buscar agendamento';
      res.status(404).json({ erro: msg });
    }
  }

  /** POST /agendamentos */
  static async criar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { clienteId, barbeiroId, servicoId, servicosIds, dataHora, observacoes } = req.body;

      if (!clienteId || !barbeiroId || !servicoId || !dataHora) {
        res.status(400).json({ erro: 'Dados obrigatórios ausentes.' });
        return;
      }

      const agendamento = await AgendamentoService.criar({
        barbeariaId: req.usuario!.barbeariaId!,
        clienteId,
        barbeiroId,
        servicoId,
        servicosIds,
        dataHora,
        observacoes,
        origem: 'SISTEMA',
        status: 'AGUARDANDO',
      });
      res.status(201).json(agendamento);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao criar agendamento';
      res.status(400).json({ erro: msg });
    }
  }

  static async atualizar(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Confiança zero no navegador: valores monetários nunca podem vir da requisição
      delete req.body.valorCobrado;
      delete req.body.valorBruto;
      delete req.body.valorLiquido;
      delete req.body.valorDesconto;

      const agendamento = await AgendamentoService.atualizar(req.params.id, req.body, req.usuario?.id);
      res.json(agendamento);
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : 'Erro ao atualizar agendamento';
      const status = error.status || 400;
      res.status(status).json({ erro: msg });
    }
  }

  /** DELETE /agendamentos/:id */
  static async cancelar(req: AuthRequest, res: Response): Promise<void> {
    try {
      await AgendamentoService.cancelar(req.params.id);
      res.json({ mensagem: 'Agendamento cancelado com sucesso' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao cancelar agendamento';
      res.status(400).json({ erro: msg });
    }
  }

  /** GET /agenda/:barbeiroId?data=YYYY-MM-DD */
  static async horarios(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { barbeiroId } = req.params;
      const data = (req.query.data as string) || diaBrasiliaStr();
      const horarios = await AgendamentoService.horariosDisponivies(barbeiroId, data);
      res.json(horarios);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao buscar horários';
      res.status(500).json({ erro: msg });
    }
  }

  /** POST /agendamentos/:id/simular-desconto */
  static async simularDesconto(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { tipoDesconto, descontoReais, descontoPercentual, pontosUsados } = req.body;

      if (!tipoDesconto) {
        res.status(400).json({ erro: 'O campo tipoDesconto é obrigatório.' });
        return;
      }

      const simulacao = await AgendamentoService.simularDesconto(
        id,
        tipoDesconto,
        descontoReais ? Number(descontoReais) : 0,
        descontoPercentual ? Number(descontoPercentual) : 0,
        pontosUsados ? Number(pontosUsados) : 0
      );

      res.json(simulacao);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao simular desconto';
      res.status(400).json({ erro: msg });
    }
  }
}
