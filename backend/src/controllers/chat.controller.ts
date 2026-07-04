// Controller de chat
import { Response } from 'express';
import { ChatService } from '../services/chat.service';
import { ClienteAuthRequest, AuthRequest } from '../types';

export class ChatController {
  // ─── Cliente ───────────────────────────────────────────────────────────────

  /** GET /cliente/barbearia/:barbeariaId/chat */
  static async clienteGetMensagens(req: ClienteAuthRequest, res: Response): Promise<void> {
    try {
      const clienteId = req.cliente!.clienteId;
      const { barbeariaId } = req.params;
      const mensagens = await ChatService.getMensagens(clienteId, barbeariaId);
      res.json(mensagens);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao buscar mensagens';
      res.status(500).json({ erro: mensagem });
    }
  }

  /** POST /cliente/barbearia/:barbeariaId/chat */
  static async clienteEnviar(req: ClienteAuthRequest, res: Response): Promise<void> {
    try {
      const clienteId = req.cliente!.clienteId;
      const { barbeariaId } = req.params;
      const { texto } = req.body;

      if (!texto || !texto.trim()) {
        res.status(400).json({ erro: 'Mensagem não pode ser vazia' });
        return;
      }

      const mensagem = await ChatService.clienteEnviar(clienteId, barbeariaId, texto.trim());
      res.status(201).json(mensagem);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao enviar mensagem';
      res.status(500).json({ erro: mensagem });
    }
  }

  /** POST /cliente/barbearia/:barbeariaId/chat/digitando */
  static async clienteDigitando(req: ClienteAuthRequest, res: Response): Promise<void> {
    try {
      const clienteId = req.cliente!.clienteId;
      const { barbeariaId } = req.params;
      ChatService.registrarDigitando(barbeariaId, clienteId, 'CLIENTE');
      res.json({ success: true });
    } catch {
      res.status(500).json({ erro: 'Erro ao registrar' });
    }
  }

  // ─── Admin ─────────────────────────────────────────────────────────────────

  /** GET /chat/conversas */
  static async listarConversas(req: AuthRequest, res: Response): Promise<void> {
    try {
      const barbeariaId = req.usuario!.barbeariaId!;
      const conversas = await ChatService.listarConversas(barbeariaId);
      res.json(conversas);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao listar conversas';
      res.status(500).json({ erro: mensagem });
    }
  }

  /** GET /chat/conversas/:clienteId */
  static async adminGetMensagens(req: AuthRequest, res: Response): Promise<void> {
    try {
      const barbeariaId = req.usuario!.barbeariaId!;
      const { clienteId } = req.params;
      const mensagens = await ChatService.adminGetMensagens(barbeariaId, clienteId);
      res.json(mensagens);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao buscar mensagens';
      res.status(500).json({ erro: mensagem });
    }
  }

  /** POST /chat/conversas/:clienteId */
  static async adminEnviar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const barbeariaId = req.usuario!.barbeariaId!;
      const { clienteId } = req.params;
      const { texto } = req.body;

      if (!texto || !texto.trim()) {
        res.status(400).json({ erro: 'Mensagem não pode ser vazia' });
        return;
      }

      const mensagem = await ChatService.adminEnviar(barbeariaId, clienteId, texto.trim());
      res.status(201).json(mensagem);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao enviar mensagem';
      res.status(500).json({ erro: mensagem });
    }
  }

  /** POST /chat/conversas/:clienteId/digitando */
  static async adminDigitando(req: AuthRequest, res: Response): Promise<void> {
    try {
      const barbeariaId = req.usuario!.barbeariaId!;
      const { clienteId } = req.params;
      ChatService.registrarDigitando(barbeariaId, clienteId, 'ADMIN');
      res.json({ success: true });
    } catch {
      res.status(500).json({ erro: 'Erro ao registrar' });
    }
  }

  /** GET /chat/nao-lidas */
  static async totalNaoLidas(req: AuthRequest, res: Response): Promise<void> {
    try {
      const barbeariaId = req.usuario!.barbeariaId!;
      const total = await ChatService.totalNaoLidas(barbeariaId);
      res.json({ total });
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao contar mensagens' });
    }
  }
}
