import { Router, Request, Response } from 'express';
import { VerificacaoService } from '../services/verificacao.service';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.post('/enviar', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id, email, nome } = (req as any).usuario;
    await VerificacaoService.enviarCodigo(id, email, nome);
    res.json({ mensagem: 'Código enviado para seu email.' });
  } catch (error: any) {
    res.status(500).json({ erro: error.message });
  }
});

router.post('/confirmar', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { codigo } = req.body;
    const { id } = (req as any).usuario;

    if (!codigo) {
      res.status(400).json({ erro: 'Código é obrigatório.' });
      return;
    }

    const valido = await VerificacaoService.verificarCodigo(id, codigo);

    if (!valido) {
      res.status(400).json({ erro: 'Código inválido ou expirado.' });
      return;
    }

    res.json({ mensagem: 'Email verificado com sucesso!' });
  } catch (error: any) {
    res.status(500).json({ erro: error.message });
  }
});

router.post('/reenviar', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id, email, nome } = (req as any).usuario;

    const usuario = await (await import('../services/verificacao.service')).VerificacaoService.enviarCodigo(id, email, nome);
    res.json({ mensagem: 'Código reenviado com sucesso.' });
  } catch (error: any) {
    res.status(500).json({ erro: error.message });
  }
});

export default router;
