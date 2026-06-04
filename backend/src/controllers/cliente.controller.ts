// Controller de clientes — endpoints admin com dados agregados
import { Response } from 'express';
import { ClienteService } from '../services/cliente.service';
import { AuthRequest } from '../types';

export class ClienteController {
  /** GET /clientes — lista clientes da barbearia com dados agregados */
  static async listar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const barbeariaId = req.usuario?.barbeariaId;
      if (!barbeariaId) {
        res.status(400).json({ erro: 'Barbearia não identificada no token.' });
        return;
      }

      const { busca, nivel, ordenar } = req.query;
      const clientes = await ClienteService.listarTodos(barbeariaId, {
        busca: busca as string | undefined,
        nivel: nivel as string | undefined,
        ordenar: ordenar as string | undefined,
      });
      res.json(clientes);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao listar clientes';
      res.status(500).json({ erro: msg });
    }
  }

  /** GET /clientes/resumo — cards de resumo */
  static async resumo(req: AuthRequest, res: Response): Promise<void> {
    try {
      const barbeariaId = req.usuario?.barbeariaId;
      if (!barbeariaId) {
        res.status(400).json({ erro: 'Barbearia não identificada no token.' });
        return;
      }

      const dados = await ClienteService.resumo(barbeariaId);
      res.json(dados);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao buscar resumo';
      res.status(500).json({ erro: msg });
    }
  }

  /** GET /clientes/aniversariantes — aniversariantes do mês */
  static async aniversariantes(req: AuthRequest, res: Response): Promise<void> {
    try {
      const barbeariaId = req.usuario?.barbeariaId;
      if (!barbeariaId) {
        res.status(400).json({ erro: 'Barbearia não identificada no token.' });
        return;
      }

      const dados = await ClienteService.aniversariantesDoMes(barbeariaId);
      res.json(dados);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao buscar aniversariantes';
      res.status(500).json({ erro: msg });
    }
  }

  /** GET /clientes/:id — perfil completo do cliente */
  static async buscar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const barbeariaId = req.usuario?.barbeariaId;
      if (!barbeariaId) {
        res.status(400).json({ erro: 'Barbearia não identificada no token.' });
        return;
      }

      const cliente = await ClienteService.buscarPorIdCompleto(req.params.id, barbeariaId);
      res.json(cliente);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao buscar cliente';
      res.status(404).json({ erro: msg });
    }
  }

  /** POST /clientes/:id/pontos — adicionar pontos manualmente */
  static async adicionarPontos(req: AuthRequest, res: Response): Promise<void> {
    try {
      const barbeariaId = req.usuario?.barbeariaId;
      if (!barbeariaId) {
        res.status(400).json({ erro: 'Barbearia não identificada no token.' });
        return;
      }

      const { pontos, descricao } = req.body;
      if (!pontos || pontos <= 0) {
        res.status(400).json({ erro: 'Quantidade de pontos deve ser maior que zero.' });
        return;
      }

      const resultado = await ClienteService.adicionarPontos(
        req.params.id,
        barbeariaId,
        Number(pontos),
        descricao || 'Cortesia do admin',
      );
      res.status(201).json(resultado);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao adicionar pontos';
      res.status(400).json({ erro: msg });
    }
  }

  /** POST /clientes/:id/resgatar/:recompensaId — resgatar recompensa */
  static async resgatarRecompensa(req: AuthRequest, res: Response): Promise<void> {
    try {
      const barbeariaId = req.usuario?.barbeariaId;
      if (!barbeariaId) {
        res.status(400).json({ erro: 'Barbearia não identificada no token.' });
        return;
      }

      const resultado = await ClienteService.resgatarRecompensa(
        req.params.id,
        req.params.recompensaId,
        barbeariaId,
      );
      res.status(201).json(resultado);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao resgatar recompensa';
      res.status(400).json({ erro: msg });
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
