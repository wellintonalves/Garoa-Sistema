// Controller de estoque
import { Response } from 'express';
import { EstoqueService } from '../services/estoque.service';
import { AuthRequest } from '../types';

export class EstoqueController {
  /** GET /estoque */
  static async listar(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const itens = await EstoqueService.listarTodos();
      res.json(itens);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao listar estoque';
      res.status(500).json({ erro: msg });
    }
  }

  /** GET /estoque/baixo */
  static async estoqueBaixo(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const itens = await EstoqueService.estoqueBaixo();
      res.json(itens);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao verificar estoque';
      res.status(500).json({ erro: msg });
    }
  }

  /** GET /estoque/:id */
  static async buscar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const item = await EstoqueService.buscarPorId(req.params.id);
      res.json(item);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao buscar item';
      res.status(404).json({ erro: msg });
    }
  }

  /** POST /estoque */
  static async criar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { nome, quantidade, unidade, custo } = req.body;

      if (!nome || quantidade === undefined || !unidade || custo === undefined) {
        res.status(400).json({ erro: 'Nome, quantidade, unidade e custo são obrigatórios' });
        return;
      }

      const item = await EstoqueService.criar(req.body);
      res.status(201).json(item);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao criar item';
      res.status(400).json({ erro: msg });
    }
  }

  /** PUT /estoque/:id */
  static async atualizar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const item = await EstoqueService.atualizar(req.params.id, req.body);
      res.json(item);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao atualizar item';
      res.status(400).json({ erro: msg });
    }
  }

  /** DELETE /estoque/:id */
  static async remover(req: AuthRequest, res: Response): Promise<void> {
    try {
      await EstoqueService.remover(req.params.id);
      res.json({ mensagem: 'Item removido com sucesso' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao remover item';
      res.status(400).json({ erro: msg });
    }
  }
}
