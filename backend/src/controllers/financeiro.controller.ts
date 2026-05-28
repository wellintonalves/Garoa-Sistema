// Controller financeiro
import { Response } from 'express';
import { FinanceiroService } from '../services/financeiro.service';
import { AuthRequest } from '../types';

export class FinanceiroController {
  /** GET /financeiro */
  static async listar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { inicio, fim, tipo } = req.query;
      const lancamentos = await FinanceiroService.listarTodos({
        inicio: inicio as string,
        fim: fim as string,
        tipo: tipo as 'ENTRADA' | 'SAIDA',
      });
      res.json(lancamentos);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao listar lançamentos';
      res.status(500).json({ erro: msg });
    }
  }

  /** POST /financeiro */
  static async criar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { tipo, categoria, valor, formaPagamento, data } = req.body;

      if (!tipo || !categoria || valor === undefined || !formaPagamento || !data) {
        res.status(400).json({ erro: 'Tipo, categoria, valor, forma de pagamento e data são obrigatórios' });
        return;
      }

      const lancamento = await FinanceiroService.criar(req.body);
      res.status(201).json(lancamento);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao criar lançamento';
      res.status(400).json({ erro: msg });
    }
  }

  /** PUT /financeiro/:id */
  static async atualizar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const lancamento = await FinanceiroService.atualizar(req.params.id, req.body);
      res.json(lancamento);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao atualizar lançamento';
      res.status(400).json({ erro: msg });
    }
  }

  /** DELETE /financeiro/:id */
  static async remover(req: AuthRequest, res: Response): Promise<void> {
    try {
      await FinanceiroService.remover(req.params.id);
      res.json({ mensagem: 'Lançamento removido com sucesso' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao remover lançamento';
      res.status(400).json({ erro: msg });
    }
  }

  /** GET /financeiro/resumo-dia?data=YYYY-MM-DD */
  static async resumoDia(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = (req.query.data as string) || new Date().toISOString().split('T')[0];
      const resumo = await FinanceiroService.resumoDoDia(data);
      res.json(resumo);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao gerar resumo';
      res.status(500).json({ erro: msg });
    }
  }

  /** GET /financeiro/ultimos-7-dias */
  static async ultimos7Dias(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const dados = await FinanceiroService.ultimos7Dias();
      res.json(dados);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao buscar dados';
      res.status(500).json({ erro: msg });
    }
  }

  /** GET /financeiro/relatorio */
  static async relatorio(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { inicio, fim, barbeiroId } = req.query;
      
      if (!inicio || !fim) {
        res.status(400).json({ erro: 'Filtros de data (inicio e fim) são obrigatórios' });
        return;
      }
      
      const dados = await FinanceiroService.relatorio({
        inicio: inicio as string,
        fim: fim as string,
        barbeiroId: barbeiroId as string
      });
      
      res.json(dados);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao gerar relatório financeiro';
      res.status(500).json({ erro: msg });
    }
  }

  /** GET /financeiro/dashboard?inicio=YYYY-MM-DD&fim=YYYY-MM-DD */
  static async dashboardResumo(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { inicio, fim } = req.query;

      if (!inicio || !fim) {
        res.status(400).json({ erro: 'Parâmetros inicio e fim são obrigatórios (YYYY-MM-DD)' });
        return;
      }

      const dados = await FinanceiroService.dashboardResumo(inicio as string, fim as string);
      res.json(dados);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao gerar resumo do dashboard';
      res.status(500).json({ erro: msg });
    }
  }
}
