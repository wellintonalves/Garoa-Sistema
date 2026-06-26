// Controller de estoque — CRUD + vendas
import { Response } from 'express';
import { EstoqueService } from '../services/estoque.service';
import { AuthRequest } from '../types';
import { FormaPagamento } from '@prisma/client';

export class EstoqueController {
  /** GET /estoque */
  static async listar(_req: AuthRequest, res: Response): Promise<void> {
    try {
      res.json(await EstoqueService.listarTodos());
    } catch (error) {
      res.status(500).json({ erro: error instanceof Error ? error.message : 'Erro ao listar estoque' });
    }
  }

  /** GET /estoque/kpis */
  static async kpis(_req: AuthRequest, res: Response): Promise<void> {
    try {
      res.json(await EstoqueService.valorEstoque());
    } catch (error) {
      res.status(500).json({ erro: error instanceof Error ? error.message : 'Erro ao calcular KPIs' });
    }
  }

  /** GET /estoque/baixo */
  static async estoqueBaixo(_req: AuthRequest, res: Response): Promise<void> {
    try {
      res.json(await EstoqueService.estoqueBaixo());
    } catch (error) {
      res.status(500).json({ erro: error instanceof Error ? error.message : 'Erro ao verificar estoque' });
    }
  }

  /** GET /estoque/vendas */
  static async listarVendas(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { inicio, fim } = req.query as { inicio?: string; fim?: string };
      res.json(await EstoqueService.resumoVendas(inicio, fim));
    } catch (error) {
      res.status(500).json({ erro: error instanceof Error ? error.message : 'Erro ao listar vendas' });
    }
  }

  /** GET /estoque/:id */
  static async buscar(req: AuthRequest, res: Response): Promise<void> {
    try {
      res.json(await EstoqueService.buscarPorId(req.params.id));
    } catch (error) {
      res.status(404).json({ erro: error instanceof Error ? error.message : 'Item não encontrado' });
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
      res.status(201).json(await EstoqueService.criar(req.body));
    } catch (error) {
      res.status(400).json({ erro: error instanceof Error ? error.message : 'Erro ao criar item' });
    }
  }

  /** PUT /estoque/:id */
  static async atualizar(req: AuthRequest, res: Response): Promise<void> {
    try {
      res.json(await EstoqueService.atualizar(req.params.id, req.body));
    } catch (error) {
      res.status(400).json({ erro: error instanceof Error ? error.message : 'Erro ao atualizar item' });
    }
  }

  /** DELETE /estoque/:id */
  static async remover(req: AuthRequest, res: Response): Promise<void> {
    try {
      await EstoqueService.remover(req.params.id);
      res.json({ mensagem: 'Item removido com sucesso' });
    } catch (error) {
      res.status(400).json({ erro: error instanceof Error ? error.message : 'Erro ao remover item' });
    }
  }

  /** POST /estoque/vender-carrinho */
  static async venderCarrinho(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { itens, formaPagamento } = req.body;
      if (!Array.isArray(itens) || itens.length === 0) {
        res.status(400).json({ erro: 'Carrinho vazio ou inválido' });
        return;
      }
      if (!formaPagamento || !Object.values(FormaPagamento).includes(formaPagamento)) {
        res.status(400).json({ erro: 'Forma de pagamento inválida' });
        return;
      }
      const resultado = await EstoqueService.venderCarrinho(itens, formaPagamento as FormaPagamento);
      res.status(201).json(resultado);
    } catch (error) {
      res.status(400).json({ erro: error instanceof Error ? error.message : 'Erro ao fechar venda do carrinho' });
    }
  }

  /** POST /estoque/:id/vender */
  static async vender(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { quantidade, formaPagamento } = req.body;
      if (!quantidade || quantidade <= 0) {
        res.status(400).json({ erro: 'Quantidade inválida' });
        return;
      }
      if (!formaPagamento || !Object.values(FormaPagamento).includes(formaPagamento)) {
        res.status(400).json({ erro: 'Forma de pagamento inválida' });
        return;
      }
      const resultado = await EstoqueService.vender(
        req.params.id,
        Number(quantidade),
        formaPagamento as FormaPagamento,
      );
      res.status(201).json(resultado);
    } catch (error) {
      res.status(400).json({ erro: error instanceof Error ? error.message : 'Erro ao registrar venda' });
    }
  }
}
