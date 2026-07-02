// Controller de agendamentos
import { Response } from 'express';
import { AgendamentoService } from '../services/agendamento.service';
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
      const { clienteId, barbeiroId, servicoId, dataHora, valorCobrado } = req.body;

      if (!clienteId || !barbeiroId || !servicoId || !dataHora || valorCobrado === undefined) {
        res.status(400).json({ erro: 'Todos os campos obrigatórios devem ser preenchidos' });
        return;
      }

      const agendamento = await AgendamentoService.criar(req.body);
      res.status(201).json(agendamento);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao criar agendamento';
      res.status(400).json({ erro: msg });
    }
  }

  /** PUT /agendamentos/:id */
  static async atualizar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const agendamento = await AgendamentoService.atualizar(req.params.id, req.body);
      res.json(agendamento);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao atualizar agendamento';
      res.status(400).json({ erro: msg });
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
      const data = (req.query.data as string) || new Date().toISOString().split('T')[0];
      const horarios = await AgendamentoService.horariosDisponivies(barbeiroId, data);
      res.json(horarios);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao buscar horários';
      res.status(500).json({ erro: msg });
    }
  }
}
