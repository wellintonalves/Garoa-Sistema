import { Request, Response } from 'express';
import { BloqueioService } from '../services/bloqueio.service';
import { AppError } from '../middlewares/error.middleware';
import { prisma } from '../lib/prisma';

export class BloqueioController {
  static async criar(req: Request, res: Response) {
    const { barbeiroId, dataInicio, dataFim, motivo } = req.body;
    const usuario = req.usuario;

    // Se quem está criando não for admin, ele deve ser o próprio barbeiro
    if (usuario?.papel !== 'ADMIN') {
      const barbeiro = await prisma.barbeiro.findUnique({
        where: { usuarioId: usuario?.id }
      });

      if (!barbeiro || barbeiro.id !== barbeiroId) {
        throw new AppError('Não autorizado a bloquear agenda de outro barbeiro', 403);
      }
    }

    if (!barbeiroId || !dataInicio || !dataFim) {
      throw new AppError('Barbeiro, data inicial e final são obrigatórios');
    }

    const bloqueio = await BloqueioService.criar(barbeiroId, dataInicio, dataFim, motivo);
    return res.status(201).json(bloqueio);
  }

  static async listar(req: Request, res: Response) {
    const { barbeiroId, aPartirDeHoje } = req.query;
    const usuario = req.usuario;

    // Se não for admin, filtra automaticamente pelo próprio ID (a menos que a rota seja pública para todos os bloqueios, mas geralmente é fechado)
    let bId = barbeiroId as string | undefined;

    if (usuario?.papel === 'BARBEIRO') {
      const barbeiro = await prisma.barbeiro.findUnique({
        where: { usuarioId: usuario.id }
      });
      if (barbeiro) {
        // Barbeiro só pode ver os próprios bloqueios, ou todos da barbearia? Vamos restringir aos dele.
        bId = barbeiro.id;
      }
    }

    const aPartirDe = aPartirDeHoje === 'true' ? new Date() : undefined;

    const bloqueios = await BloqueioService.listar({ barbeiroId: bId, aPartirDe });
    return res.json(bloqueios);
  }

  static async remover(req: Request, res: Response) {
    const { id } = req.params;
    const usuario = req.usuario;

    const bloqueio = await prisma.bloqueioAgenda.findUnique({
      where: { id }
    });

    if (!bloqueio) {
      throw new AppError('Bloqueio não encontrado', 404);
    }

    // Validação de acesso
    if (usuario?.papel !== 'ADMIN') {
      const barbeiro = await prisma.barbeiro.findUnique({
        where: { usuarioId: usuario?.id }
      });

      if (!barbeiro || barbeiro.id !== bloqueio.barbeiroId) {
        throw new AppError('Não autorizado a remover bloqueio de outro barbeiro', 403);
      }
    }

    await BloqueioService.remover(id);
    return res.status(204).send();
  }
}
