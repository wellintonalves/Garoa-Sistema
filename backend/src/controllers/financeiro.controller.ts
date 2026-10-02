import { registrarErroSeguro } from '../lib/logSeguro';
// Controller financeiro
import { FormaPagamento } from '@prisma/client';
import { Response } from 'express';
import { FinanceiroService } from '../services/financeiro.service';
import { diaBrasiliaStr } from '../lib/timezone';
import { AuthRequest } from '../types';
import { ErroDeNegocio } from '../lib/erros';

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
      console.log(JSON.stringify({ evento: 'financeiro_criado' }));
      res.status(201).json(lancamento);
    } catch (error) {
      registrarErroSeguro('financeiro_criar_falha', error);
      const msg = error instanceof Error ? error.message : 'Erro ao criar lançamento';
      res.status(error instanceof ErroDeNegocio ? error.status : 400).json({ erro: msg });
    }
  }

  /** POST /financeiro/simular-desconto */
  static async simularDesconto(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { tipoDesconto, descontoReais, descontoPercentual, pontosUsados, clienteId, itens, servicosIds, servicoId, barbeiroId } = req.body;
      const simulacao = await FinanceiroService.simularDesconto({
        tipoDesconto, descontoReais, descontoPercentual, pontosUsados, clienteId, itens, servicosIds, servicoId, barbeiroId
      });
      res.json(simulacao);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao simular desconto';
      res.status(400).json({ erro: msg });
    }
  }

  /** PUT /financeiro/:id */
  static async atualizar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const isAdmin = req.usuario?.papel === 'ADMIN';
      const lancamento = await FinanceiroService.atualizar(req.params.id, req.body, isAdmin);
      res.json(lancamento);
    } catch (error) {
      if (error instanceof ErroDeNegocio) {
        res.status(error.status).json({ erro: error.message });
      } else {
        registrarErroSeguro('financeiro_atualizar_falha', error);
        res.status(500).json({ erro: 'Não foi possível atualizar o lançamento. Tente novamente.' });
      }
    }
  }

  /** DELETE /financeiro/:id */
  static async remover(req: AuthRequest, res: Response): Promise<void> {
    try {
      const isAdmin = req.usuario?.papel === 'ADMIN';
      const resultado = await FinanceiroService.remover(req.params.id, isAdmin);
      res.json(resultado || { mensagem: 'Lançamento removido com sucesso' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao remover lançamento';
      res.status(400).json({ erro: msg });
    }
  }

  /** POST /financeiro/:id/adicionar */
  static async adicionarPendente(req: AuthRequest, res: Response): Promise<void> {
    try {
      const resultado = await FinanceiroService.adicionarPendente(req.params.id, req.body);
      res.json(resultado);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao adicionar lançamento pendente';
      res.status(400).json({ erro: msg });
    }
  }

  /** GET /financeiro/resumo-dia?data=YYYY-MM-DD */
  static async resumoDia(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = (req.query.data as string) || diaBrasiliaStr();
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

  static async produtosRelatorio(_req: AuthRequest, res: Response): Promise<void> {
    try {
      res.json(await FinanceiroService.produtosRelatorio());
    } catch (error) {
      res.status(error instanceof ErroDeNegocio ? error.status : 500).json({ erro: 'Não foi possível carregar os produtos do relatório.' });
    }
  }

  /** GET /financeiro/relatorio */
  static async relatorio(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { inicio, fim, barbeiroId, natureza, pagamento, produtoId } = req.query;
      if (barbeiroId !== undefined && typeof barbeiroId !== 'string') {
        res.status(400).json({ erro: 'Barbeiro inválido.' });
        return;
      }
      if (produtoId !== undefined && (typeof produtoId !== 'string' || (produtoId !== 'todos' && !/^(estoque|historico):.+$/.test(produtoId)))) {
        res.status(400).json({ erro: 'Produto inválido.' });
        return;
      }
      if (pagamento !== undefined && (typeof pagamento !== 'string' || !['todos', 'CARTAO', ...Object.values(FormaPagamento)].includes(pagamento))) {
        res.status(400).json({ erro: 'Forma de pagamento inválida.' });
        return;
      }
      if (natureza !== undefined && natureza !== 'todos' && natureza !== 'produtos' && natureza !== 'servicos') {
        res.status(400).json({ erro: 'Selecione Todos, Produtos ou Serviços.' });
        return;
      }
      
      const dataValida = (valor: unknown): valor is string => {
        if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor.startsWith('0000')) return false;
        const data = new Date(`${valor}T12:00:00Z`);
        return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor;
      };
      if ((inicio !== undefined || fim !== undefined) && (!dataValida(inicio) || !dataValida(fim) || inicio > fim)) {
        res.status(400).json({ erro: 'Informe um período válido com data inicial e final, ou omita ambas para consultar todo o histórico.' });
        return;
      }
      
      const dados = await FinanceiroService.relatorio({
        inicio: inicio as string | undefined,
        fim: fim as string | undefined,
        barbeiroId: barbeiroId as string,
        natureza,
        pagamento: pagamento as 'todos' | 'CARTAO' | FormaPagamento | undefined,
        produtoId: produtoId as string | undefined
      });
      
      res.json(dados);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao gerar relatório financeiro';
      res.status(error instanceof ErroDeNegocio ? error.status : 500).json({ erro: msg });
    }
  }

  /** GET /financeiro/dashboard?inicio=YYYY-MM-DD&fim=YYYY-MM-DD */
  static async dashboardResumo(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { inicio, fim, periodo } = req.query;

      if (!inicio || !fim) {
        res.status(400).json({ erro: 'Parâmetros inicio e fim são obrigatórios (YYYY-MM-DD)' });
        return;
      }

      const dados = await FinanceiroService.dashboardResumo(inicio as string, fim as string, periodo as string);
      res.json(dados);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao gerar resumo do dashboard';
      res.status(500).json({ erro: msg });
    }
  }
}
