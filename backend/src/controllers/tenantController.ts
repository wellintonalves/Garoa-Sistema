import { ConfirmacaoEmailNecessaria } from '../services/confirmacaoEmail.util';
import { iniciarSessao } from '../services/sessao.service';
import { VerificacaoService } from '../services/verificacao.service';
import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthService } from '../services/auth.service';
import { AuthRequest } from '../types';
import { HorariosUtil } from '../services/horarios.util';
import { objetoPermitido, texto } from '../utils/entradaSegura.util';
import { reciboAgendamento } from '../utils/agendamentoEntrada.util';
import { ErroDeNegocio } from '../lib/erros';

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

  /** GET /b/:slug/identidade - Retorna a identidade visual da barbearia */
  static async getIdentidade(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const barbearia = await prisma.barbearia.findUnique({
        where: { slug },
        select: {
          nome: true,
          logo: true,
          corPrimaria: true,
          corSecundaria: true,
          corTexto: true,
          fonte: true
        }
      });
      if (!barbearia) {
        res.status(404).json({ erro: 'Barbearia não encontrada' });
        return;
      }
      res.json(barbearia);
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao buscar identidade' });
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

      const resultado = await AuthService.registrarCliente({
        nome,
        email,
        senha,
        aceiteDocumentos: req.body.aceiteDocumentos,
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

      await VerificacaoService.enviarCodigo(resultado.usuario.id);
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

      const resultado = await AuthService.login({ email, senha, barbeariaId: barbearia.id, papel: 'CLIENTE' });
      
      if (resultado.usuario.barbeariaId !== barbearia.id) {
         res.status(401).json({ erro: 'Usuário não pertence a esta barbearia' });
         return;
      }

      const tokenPonte = await iniciarSessao(req, res, resultado.usuario.id, 'tenant');
      res.json({ ...resultado, ...(tokenPonte ? { token: tokenPonte } : {}) });
    } catch (error) {
      if (error instanceof ConfirmacaoEmailNecessaria) {
        await VerificacaoService.enviarCodigo(error.usuarioId).catch(() => undefined);
        res.status(403).json({ erro: error.message, emailNaoVerificado: true, usuarioId: error.usuarioId });
        return;
      }
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
      const barbearia = await prisma.barbearia.findFirst({ where: { id: barbeariaId || '', slug: req.params.slug, ativo: true }, select: { id: true } });
      if (!barbearia) { res.status(404).json({ erro: 'Barbearia não encontrada.' }); return; }

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
      const barbearia = await prisma.barbearia.findFirst({ where: { id: barbeariaId || '', slug: req.params.slug, ativo: true }, select: { id: true } });
      if (!barbearia) { res.status(404).json({ erro: 'Barbearia não encontrada.' }); return; }

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

      const { ClienteAppService } = await import('../services/clienteApp.service');
      res.json(await ClienteAppService.fidelidade(cliente.id, barbeariaId));

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

  /** POST /b/:slug/agendar and /b/:slug/app/agendar */
  static async agendar(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.usuario || req.usuario.papel !== 'CLIENTE') throw new ErroDeNegocio('Entre na sua conta para continuar.', 401);
      const barbearia = await prisma.barbearia.findFirst({ where: { slug: req.params.slug, ativo: true } });
      if (!barbearia || req.usuario.barbeariaId !== barbearia.id) throw new ErroDeNegocio('Barbearia não encontrada.', 404);
      const dados = objetoPermitido(req.body, ['barbeiroId', 'servicoId', 'data', 'hora', 'observacoes']);
      const cliente = await prisma.cliente.findFirst({
        where: { usuarioId: req.usuario.id, usuario: { papel: 'CLIENTE', emailVerificado: true } }, select: { id: true },
      });
      if (!cliente) throw new ErroDeNegocio('Entre na sua conta para continuar.', 401);
      const { AgendamentoService } = await import('../services/agendamento.service');
      const servicoId = texto(dados.servicoId);
      const agendamento = await AgendamentoService.criar({
        barbeariaId: barbearia.id, clienteId: cliente.id, barbeiroId: texto(dados.barbeiroId),
        servicoId, servicosIds: [servicoId],
        dataHora: `${texto(dados.data, 10)}T${texto(dados.hora, 5)}:00`,
        observacoes: dados.observacoes === undefined ? undefined : texto(dados.observacoes, 4000, true),
        origem: 'APP_CLIENTE',
      }, req.usuario);
      res.status(201).json(reciboAgendamento(agendamento));
    } catch (error) {
      res.status(error instanceof ErroDeNegocio ? error.status : 400).json({ erro: error instanceof Error ? error.message : 'Não foi possível agendar. Tente novamente.' });
    }
  }
}
