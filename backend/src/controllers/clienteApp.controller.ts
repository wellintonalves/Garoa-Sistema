// Controller do app do cliente
import { Response } from 'express';
import { ClienteAppService } from '../services/clienteApp.service';
import { ClienteAuthRequest } from '../types';
import { Request } from 'express';
import { VerificacaoService } from '../services/verificacao.service';

export class ClienteAppController {
  /** POST /cliente/register */
  static async registrar(req: Request, res: Response): Promise<void> {
    try {
      const { nome, email, senha, telefone } = req.body;

      if (!nome || !email || !senha) {
        res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
        return;
      }

      if (senha.length < 6) {
        res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres' });
        return;
      }

      const resultado = await ClienteAppService.registrar({ nome, email, senha, telefone });

      // Tenta enviar o email mas não bloqueia o cadastro se falhar
      try {
        await VerificacaoService.enviarCodigo(resultado.cliente.usuarioId, email, nome);
      } catch (emailErro) {
        console.error('[Registro Cliente] Erro ao enviar email de verificação:', emailErro);
      }

      res.status(201).json(resultado);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao registrar';
      res.status(400).json({ erro: mensagem });
    }
  }

  /** POST /cliente/login */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, senha } = req.body;

      if (!email || !senha) {
        res.status(400).json({ erro: 'Email e senha são obrigatórios' });
        return;
      }

      const resultado = await ClienteAppService.login(email, senha);
      res.json(resultado);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao fazer login';
      res.status(401).json({ erro: mensagem });
    }
  }

  /** GET /cliente/buscar-barbearia?nome= */
  static async buscarBarbearia(req: ClienteAuthRequest, res: Response): Promise<void> {
    try {
      const nome = req.query.nome as string;
      if (!nome) {
        res.status(400).json({ erro: 'Parâmetro nome é obrigatório' });
        return;
      }
      const barbearias = await ClienteAppService.buscarBarbearias(nome);
      res.json(barbearias);
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao buscar barbearias' });
    }
  }

  /** GET /cliente/buscar-barbearia-slug/:slug */
  static async buscarBarbeariaPorSlug(req: ClienteAuthRequest, res: Response): Promise<void> {
    try {
      const barbearia = await ClienteAppService.buscarBarbeariaPorSlug(req.params.slug);
      res.json(barbearia);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao buscar barbearia';
      res.status(404).json({ erro: msg });
    }
  }

  /** POST /cliente/conectar-barbearia */
  static async conectarBarbearia(req: ClienteAuthRequest, res: Response): Promise<void> {
    try {
      const clienteId = req.cliente?.clienteId;
      if (!clienteId) { res.status(401).json({ erro: 'Não autorizado' }); return; }

      const { barbeariaId } = req.body;
      if (!barbeariaId) {
        res.status(400).json({ erro: 'barbeariaId é obrigatório' });
        return;
      }

      const conexao = await ClienteAppService.conectarBarbearia(clienteId, barbeariaId);
      res.status(201).json(conexao);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao conectar';
      res.status(400).json({ erro: msg });
    }
  }

  /** DELETE /cliente/desconectar-barbearia/:barbeariaId */
  static async desconectarBarbearia(req: ClienteAuthRequest, res: Response): Promise<void> {
    try {
      const clienteId = req.cliente?.clienteId;
      if (!clienteId) { res.status(401).json({ erro: 'Não autorizado' }); return; }

      await ClienteAppService.desconectarBarbearia(clienteId, req.params.barbeariaId);
      res.json({ mensagem: 'Desconectado com sucesso' });
    } catch (error) {
      res.status(400).json({ erro: 'Erro ao desconectar' });
    }
  }

  /** GET /cliente/minhas-barbearias */
  static async minhasBarbearias(req: ClienteAuthRequest, res: Response): Promise<void> {
    try {
      const clienteId = req.cliente?.clienteId;
      if (!clienteId) { res.status(401).json({ erro: 'Não autorizado' }); return; }

      const barbearias = await ClienteAppService.minhasBarbearias(clienteId);
      res.json(barbearias);
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao listar barbearias' });
    }
  }

  /** GET /cliente/perfil */
  static async perfil(req: ClienteAuthRequest, res: Response): Promise<void> {
    try {
      const clienteId = req.cliente?.clienteId;
      if (!clienteId) { res.status(401).json({ erro: 'Não autorizado' }); return; }

      const perfil = await ClienteAppService.perfil(clienteId);
      res.json(perfil);
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao buscar perfil' });
    }
  }

  /** PUT /cliente/perfil */
  static async atualizarPerfil(req: ClienteAuthRequest, res: Response): Promise<void> {
    try {
      const clienteId = req.cliente?.clienteId;
      if (!clienteId) { res.status(401).json({ erro: 'Não autorizado' }); return; }

      const perfil = await ClienteAppService.atualizarPerfil(clienteId, req.body);
      res.json(perfil);
    } catch (error) {
      res.status(400).json({ erro: 'Erro ao atualizar perfil' });
    }
  }

  /** GET /cliente/barbearia/:barbeariaId/agendamentos */
  static async agendamentos(req: ClienteAuthRequest, res: Response): Promise<void> {
    try {
      const clienteId = req.cliente?.clienteId;
      if (!clienteId) { res.status(401).json({ erro: 'Não autorizado' }); return; }

      const agendamentos = await ClienteAppService.agendamentos(clienteId, req.params.barbeariaId);
      res.json(agendamentos);
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao buscar agendamentos' });
    }
  }

  /** GET /cliente/barbearia/:barbeariaId/servicos */
  static async servicos(req: ClienteAuthRequest, res: Response): Promise<void> {
    try {
      const servicos = await ClienteAppService.servicos(req.params.barbeariaId);
      res.setHeader('Cache-Control', 'no-cache');
      res.json(servicos);
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao buscar serviços' });
    }
  }

  /** GET /cliente/barbearia/:barbeariaId/barbeiros */
  static async barbeiros(req: ClienteAuthRequest, res: Response): Promise<void> {
    try {
      const barbeiros = await ClienteAppService.barbeiros(req.params.barbeariaId);
      res.setHeader('Cache-Control', 'no-cache');
      res.json(barbeiros);
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao buscar barbeiros' });
    }
  }

  /** GET /cliente/barbearia/:barbeariaId/horarios-disponiveis */
  static async horariosDisponiveis(req: ClienteAuthRequest, res: Response): Promise<void> {
    try {
      const { barbeiroId, data, servicoId } = req.query;
      if (!barbeiroId || !data || !servicoId) {
        res.status(400).json({ erro: 'barbeiroId, data e servicoId são obrigatórios' });
        return;
      }

      const slots = await ClienteAppService.horariosDisponiveis(
        req.params.barbeariaId,
        barbeiroId as string,
        data as string,
        servicoId as string
      );
      res.json(slots);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao buscar horários';
      res.status(400).json({ erro: msg });
    }
  }

  /** POST /cliente/barbearia/:barbeariaId/agendar */
  static async agendar(req: ClienteAuthRequest, res: Response): Promise<void> {
    try {
      const clienteId = req.cliente?.clienteId;
      if (!clienteId) { res.status(401).json({ erro: 'Não autorizado' }); return; }

      const agendamento = await ClienteAppService.agendar(clienteId, req.params.barbeariaId, req.body);
      res.status(201).json(agendamento);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao agendar';
      res.status(400).json({ erro: msg });
    }
  }

  /** GET /cliente/barbearia/:barbeariaId/fidelidade */
  static async fidelidade(req: ClienteAuthRequest, res: Response): Promise<void> {
    try {
      const clienteId = req.cliente?.clienteId;
      if (!clienteId) { res.status(401).json({ erro: 'Não autorizado' }); return; }

      const fidelidade = await ClienteAppService.fidelidade(clienteId, req.params.barbeariaId);
      res.json(fidelidade);
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao buscar fidelidade' });
    }
  }

  /** POST /cliente/barbearia/:barbeariaId/fidelidade/resgatar */
  static async resgatarRecompensa(req: ClienteAuthRequest, res: Response): Promise<void> {
    try {
      const clienteId = req.cliente?.clienteId;
      if (!clienteId) { res.status(401).json({ erro: 'Não autorizado' }); return; }

      const { recompensaId } = req.body;
      if (!recompensaId) {
        res.status(400).json({ erro: 'recompensaId é obrigatório' });
        return;
      }

      const resgate = await ClienteAppService.resgatarRecompensa(clienteId, req.params.barbeariaId, recompensaId);
      res.status(201).json(resgate);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao resgatar recompensa';
      res.status(400).json({ erro: msg });
    }
  }
}
