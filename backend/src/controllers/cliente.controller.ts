// Controller de clientes
import { Response } from 'express';
import { ClienteService } from '../services/cliente.service';
import { AuthRequest } from '../types';

export class ClienteController {
  /** GET /clientes */
  static async listar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { busca } = req.query;
      const clientes = busca
        ? await ClienteService.buscar(busca as string)
        : await ClienteService.listarTodos();
      res.json(clientes);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao listar clientes';
      res.status(500).json({ erro: msg });
    }
  }

  /** GET /clientes/:id */
  static async buscar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const cliente = await ClienteService.buscarPorId(req.params.id);
      res.json(cliente);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao buscar cliente';
      res.status(404).json({ erro: msg });
    }
  }

  /** POST /clientes */
  static async criar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { nome, email, senha, telefone, dataNascimento, observacoes } = req.body;

      if (!nome || !email || !senha) {
        res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
        return;
      }

      const cliente = await ClienteService.criar({
        nome, email, senha, telefone, dataNascimento, observacoes,
      });
      res.status(201).json(cliente);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao criar cliente';
      res.status(400).json({ erro: msg });
    }
  }

  /** PUT /clientes/:id */
  static async atualizar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const cliente = await ClienteService.atualizar(req.params.id, req.body);
      res.json(cliente);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao atualizar cliente';
      res.status(400).json({ erro: msg });
    }
  }

  /** DELETE /clientes/:id */
  static async remover(req: AuthRequest, res: Response): Promise<void> {
    try {
      await ClienteService.remover(req.params.id);
      res.json({ mensagem: 'Cliente removido com sucesso' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao remover cliente';
      res.status(400).json({ erro: msg });
    }
  }
}
