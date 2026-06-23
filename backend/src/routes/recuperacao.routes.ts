import { Router, Request, Response } from 'express';
import { VerificacaoService } from '../services/verificacao.service';

const router = Router();

router.post('/solicitar', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ erro: 'Email é obrigatório.' });
      return;
    }
    await VerificacaoService.enviarCodigoRecuperacao(email);
    res.json({ mensagem: 'Código enviado para seu email.' });
  } catch (error: any) {
    res.status(400).json({ erro: error.message });
  }
});

router.post('/redefinir', async (req: Request, res: Response) => {
  try {
    const { email, codigo, novaSenha } = req.body;
    if (!email || !codigo || !novaSenha) {
      res.status(400).json({ erro: 'Email, código e nova senha são obrigatórios.' });
      return;
    }
    if (novaSenha.length < 6) {
      res.status(400).json({ erro: 'A senha deve ter no mínimo 6 caracteres.' });
      return;
    }
    await VerificacaoService.redefinirSenha(email, codigo, novaSenha);
    res.json({ mensagem: 'Senha redefinida com sucesso!' });
  } catch (error: any) {
    res.status(400).json({ erro: error.message });
  }
});

export default router;
