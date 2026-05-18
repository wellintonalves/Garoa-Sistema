// Controller de serviços
import { Response } from 'express';
import { ServicoService } from '../services/servico.service';
import { AuthRequest } from '../types';

export class ServicoController {
  /** GET /servicos */
  static async listar(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const servicos = await ServicoService.listarTodos();
      res.json(servicos);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao listar serviços';
      res.status(500).json({ erro: msg });
    }
  }

  /** GET /servicos/:id */
  static async buscar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const servico = await ServicoService.buscarPorId(req.params.id);
      res.json(servico);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao buscar serviço';
      res.status(404).json({ erro: msg });
    }
  }

  /** POST /servicos */
  static async criar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { nome, preco, duracaoMinutos } = req.body;

      if (!nome || preco === undefined || !duracaoMinutos) {
        res.status(400).json({ erro: 'Nome, preço e duração são obrigatórios' });
        return;
      }

      const servico = await ServicoService.criar(req.body);
      res.status(201).json(servico);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao criar serviço';
      res.status(400).json({ erro: msg });
    }
  }

  /** PUT /servicos/:id */
  static async atualizar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const servico = await ServicoService.atualizar(req.params.id, req.body);
      res.json(servico);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao atualizar serviço';
      res.status(400).json({ erro: msg });
    }
  }

  /** DELETE /servicos/:id */
  static async desativar(req: AuthRequest, res: Response): Promise<void> {
    try {
      await ServicoService.desativar(req.params.id);
      res.json({ mensagem: 'Serviço desativado com sucesso' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao desativar serviço';
      res.status(400).json({ erro: msg });
    }
  }
}
