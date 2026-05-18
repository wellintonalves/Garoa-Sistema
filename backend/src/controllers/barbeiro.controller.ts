// Controller de barbeiros
import { Response } from 'express';
import { BarbeiroService } from '../services/barbeiro.service';
import { AuthRequest } from '../types';

export class BarbeiroController {
  /** GET /barbeiros */
  static async listar(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const barbeiros = await BarbeiroService.listarTodos();
      res.json(barbeiros);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao listar barbeiros';
      res.status(500).json({ erro: msg });
    }
  }

  /** GET /barbeiros/:id */
  static async buscar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const barbeiro = await BarbeiroService.buscarPorId(req.params.id);
      res.json(barbeiro);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao buscar barbeiro';
      res.status(404).json({ erro: msg });
    }
  }

  /** POST /barbeiros */
  static async criar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { nome, email, senha, foto, especialidades, comissaoPercent } = req.body;

      if (!nome || !email || !senha) {
        res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
        return;
      }

      const barbeiro = await BarbeiroService.criar({
        nome, email, senha, foto, especialidades, comissaoPercent,
      });
      res.status(201).json(barbeiro);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao criar barbeiro';
      res.status(400).json({ erro: msg });
    }
  }

  /** PUT /barbeiros/:id */
  static async atualizar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const barbeiro = await BarbeiroService.atualizar(req.params.id, req.body);
      res.json(barbeiro);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao atualizar barbeiro';
      res.status(400).json({ erro: msg });
    }
  }

  /** DELETE /barbeiros/:id */
  static async desativar(req: AuthRequest, res: Response): Promise<void> {
    try {
      await BarbeiroService.desativar(req.params.id);
      res.json({ mensagem: 'Barbeiro desativado com sucesso' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao desativar barbeiro';
      res.status(400).json({ erro: msg });
    }
  }
}
