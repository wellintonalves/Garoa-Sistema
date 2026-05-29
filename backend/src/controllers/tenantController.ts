import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthService } from '../services/auth.service';
import { AuthRequest } from '../types';

export class TenantController {
  /** GET /b/:slug - Retorna os dados públicos da barbearia */
  static async getBarbearia(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const barbearia = await prisma.barbearia.findUnique({
        where: { slug }
      });
      if (!barbearia || !barbearia.ativo) {
        res.status(404).json({ erro: 'Barbearia não encontrada' });
        return;
      }
      res.json(barbearia);
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao buscar barbearia' });
    }
  }

  /** POST /b/:slug/auth/register */
  static async registerClient(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const barbearia = await prisma.barbearia.findUnique({ where: { slug } });
      if (!barbearia) {
        res.status(404).json({ erro: 'Barbearia não encontrada' });
        return;
      }

      const { nome, email, senha, telefone } = req.body;
      if (!nome || !email || !senha) {
        res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
        return;
      }

      const resultado = await AuthService.registrar({
        nome,
        email,
        senha,
        papel: 'CLIENTE',
        barbeariaId: barbearia.id
      });
      
      await prisma.cliente.create({
        data: {
          usuarioId: resultado.usuario.id,
          barbeariaId: barbearia.id,
          telefone
        }
      });

      res.status(201).json(resultado);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao registrar cliente';
      res.status(400).json({ erro: msg });
    }
  }

  /** POST /b/:slug/auth/login */
  static async loginClient(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const barbearia = await prisma.barbearia.findUnique({ where: { slug } });
      if (!barbearia) {
        res.status(404).json({ erro: 'Barbearia não encontrada' });
        return;
      }

      const { email, senha } = req.body;
      if (!email || !senha) {
        res.status(400).json({ erro: 'Email e senha são obrigatórios' });
        return;
      }

      const resultado = await AuthService.login({ email, senha, barbeariaId: barbearia.id });
      
      if (resultado.usuario.barbeariaId !== barbearia.id) {
         res.status(401).json({ erro: 'Usuário não pertence a esta barbearia' });
         return;
      }

      res.json(resultado);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao fazer login';
      res.status(401).json({ erro: msg });
    }
  }

  /** GET /b/:slug/meus-agendamentos */
  static async meusAgendamentos(req: AuthRequest, res: Response): Promise<void> {
    try {
      // O middleware de autenticação deve injetar req.usuario
      const usuarioId = req.usuario?.id;
      const barbeariaId = req.usuario?.barbeariaId;

      if (!usuarioId || !barbeariaId) {
        res.status(401).json({ erro: 'Não autorizado' });
        return;
      }

      const cliente = await prisma.cliente.findUnique({
        where: { usuarioId }
      });

      if (!cliente) {
        res.status(404).json({ erro: 'Cliente não encontrado' });
        return;
      }

      const agendamentos = await prisma.agendamento.findMany({
        where: { clienteId: cliente.id, barbeariaId },
        include: {
          barbeiro: { include: { usuario: { select: { nome: true } } } },
          servico: { select: { nome: true } }
        },
        orderBy: { dataHora: 'desc' }
      });

      res.json(agendamentos);
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao buscar agendamentos' });
    }
  }

  /** GET /b/:slug/minha-fidelidade */
  static async minhaFidelidade(req: AuthRequest, res: Response): Promise<void> {
    try {
      const usuarioId = req.usuario?.id;
      const barbeariaId = req.usuario?.barbeariaId;

      if (!usuarioId || !barbeariaId) {
        res.status(401).json({ erro: 'Não autorizado' });
        return;
      }

      const cliente = await prisma.cliente.findUnique({
        where: { usuarioId }
      });

      if (!cliente) {
        res.status(404).json({ erro: 'Cliente não encontrado' });
        return;
      }

      // Mock de fidelidade (pode ser expandido no futuro)
      res.json({
        pontos: 150,
        historico: [
          { data: new Date(), pontos: 50, descricao: 'Corte de cabelo' },
        ]
      });
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao buscar fidelidade' });
    }
  }

  /** GET /b/:slug/servicos */
  static async getServicos(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const barbearia = await prisma.barbearia.findUnique({ where: { slug } });
      if (!barbearia) { res.status(404).json({ erro: 'Barbearia não encontrada' }); return; }

      const servicos = await prisma.servico.findMany({
        where: { barbeariaId: barbearia.id, ativo: true },
        orderBy: { nome: 'asc' }
      });
      res.json(servicos);
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao listar serviços' });
    }
  }

  /** GET /b/:slug/barbeiros */
  static async getBarbeiros(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const barbearia = await prisma.barbearia.findUnique({ where: { slug } });
      if (!barbearia) { res.status(404).json({ erro: 'Barbearia não encontrada' }); return; }

      const barbeiros = await prisma.barbeiro.findMany({
        where: { barbeariaId: barbearia.id, ativo: true },
        include: { usuario: { select: { nome: true, email: true } } },
      });
      res.json(barbeiros);
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao listar barbeiros' });
    }
  }

  /** GET /b/:slug/horarios-disponiveis */
  static async getHorariosDisponiveis(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const { barbeiroId, data, servicoId } = req.query;
      
      if (!barbeiroId || !data || !servicoId) {
        res.status(400).json({ erro: 'Barbeiro, data e serviço são obrigatórios' });
        return;
      }

      const barbearia = await prisma.barbearia.findUnique({ where: { slug } });
      if (!barbearia) { res.status(404).json({ erro: 'Barbearia não encontrada' }); return; }

      // TODO: Lógica real de horários. Mockando para o teste.
      res.json(['09:00', '10:00', '11:00', '14:00', '15:00', '16:00']);
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao buscar horários' });
    }
  }

  /** POST /b/:slug/agendar */
  static async agendar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const barbearia = await prisma.barbearia.findUnique({ where: { slug } });
      if (!barbearia) { res.status(404).json({ erro: 'Barbearia não encontrada' }); return; }

      const { barbeiroId, servicoId, data, hora, clienteId } = req.body;
      let finalClienteId = clienteId;

      // Se o usuário está logado, use o cliente associado
      if (req.usuario) {
        const cliente = await prisma.cliente.findUnique({ where: { usuarioId: req.usuario.id } });
        if (cliente) finalClienteId = cliente.id;
      }

      if (!finalClienteId) {
        res.status(400).json({ erro: 'Cliente não identificado' });
        return;
      }

      const servico = await prisma.servico.findUnique({ where: { id: servicoId } });
      if (!servico) { res.status(404).json({ erro: 'Serviço não encontrado' }); return; }

      const dataHora = new Date(`${data}T${hora}:00`);

      const agendamento = await prisma.agendamento.create({
        data: {
          barbeariaId: barbearia.id,
          clienteId: finalClienteId,
          barbeiroId,
          servicoId,
          dataHora,
          valorCobrado: servico.preco,
          origem: 'APP_CLIENTE'
        }
      });

      res.status(201).json(agendamento);
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao agendar' });
    }
  }
}
