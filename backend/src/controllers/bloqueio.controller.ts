import { Request, Response } from 'express';
import { BloqueioService } from '../services/bloqueio.service';
import { prisma } from '../lib/prisma';

export class BloqueioController {
  static async criar(req: Request, res: Response): Promise<void> {
    const { barbeiroId, dataInicio, dataFim, motivo } = req.body;
    const usuario = req.usuario;

    // Se quem está criando não for admin, ele deve ser o próprio barbeiro
    if (usuario?.papel !== 'ADMIN') {
      const barbeiro = await prisma.barbeiro.findUnique({
        where: { usuarioId: usuario?.id }
      });

      if (!barbeiro || barbeiro.id !== barbeiroId) {
        res.status(403).json({ erro: 'Não autorizado a bloquear agenda de outro barbeiro' });
        return;
      }
    }

    if (!barbeiroId || !dataInicio || !dataFim) {
      res.status(400).json({ erro: 'Barbeiro, data inicial e final são obrigatórios' });
      return;
    }

    const bloqueio = await BloqueioService.criar(barbeiroId, dataInicio, dataFim, motivo);
    res.status(201).json(bloqueio);
  }

  static async listar(req: Request, res: Response): Promise<void> {
    const { barbeiroId, aPartirDeHoje } = req.query;
    const usuario = req.usuario;

    // Se não for admin, filtra automaticamente pelo próprio ID (a menos que a rota seja pública para todos os bloqueios, mas geralmente é fechado)
    let bId = typeof barbeiroId === 'string' ? barbeiroId : undefined;

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

    const bloqueios = await BloqueioService.listar({ barbeiroId: bId, barbeariaId: usuario?.barbeariaId || undefined, aPartirDe });
    res.json(bloqueios);
  }

  static async remover(req: Request, res: Response): Promise<void> {
    const id = req.params.id as string;
    const usuario = req.usuario;

    const bloqueio = await prisma.bloqueioAgenda.findUnique({
      where: { id }
    });

    if (!bloqueio) {
      res.status(404).json({ erro: 'Bloqueio não encontrado' });
      return;
    }

    // Validação de acesso
    if (usuario?.papel !== 'ADMIN') {
      const barbeiro = await prisma.barbeiro.findUnique({
        where: { usuarioId: usuario?.id }
      });

      if (!barbeiro || barbeiro.id !== bloqueio.barbeiroId) {
        res.status(403).json({ erro: 'Não autorizado a remover bloqueio de outro barbeiro' });
        return;
      }
    }

    await BloqueioService.remover(id);
    res.status(204).send();
  }
}
