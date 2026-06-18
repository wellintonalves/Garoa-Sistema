import { Router, Request, Response } from 'express';
import { VerificacaoService } from '../services/verificacao.service';

const router = Router();

// Enviar código — não precisa de autenticação
router.post('/enviar', async (req: Request, res: Response) => {
  try {
    const { usuarioId, email, nome } = req.body;
    if (!usuarioId || !email || !nome) {
      res.status(400).json({ erro: 'usuarioId, email e nome são obrigatórios.' });
      return;
    }
    await VerificacaoService.enviarCodigo(usuarioId, email, nome);
    res.json({ mensagem: 'Código enviado para seu email.' });
  } catch (error: any) {
    res.status(500).json({ erro: error.message });
  }
});

// Confirmar código — não precisa de autenticação
router.post('/confirmar', async (req: Request, res: Response) => {
  try {
    const { usuarioId, codigo } = req.body;
    if (!usuarioId || !codigo) {
      res.status(400).json({ erro: 'usuarioId e codigo são obrigatórios.' });
      return;
    }
    const valido = await VerificacaoService.verificarCodigo(usuarioId, codigo);
    if (!valido) {
      res.status(400).json({ erro: 'Código inválido ou expirado.' });
      return;
    }
    res.json({ mensagem: 'Email verificado com sucesso!' });
  } catch (error: any) {
    res.status(500).json({ erro: error.message });
  }
});

// Reenviar código — não precisa de autenticação
router.post('/reenviar', async (req: Request, res: Response) => {
  try {
    const { usuarioId, email, nome } = req.body;
    if (!usuarioId || !email || !nome) {
      res.status(400).json({ erro: 'usuarioId, email e nome são obrigatórios.' });
      return;
    }
    await VerificacaoService.enviarCodigo(usuarioId, email, nome);
    res.json({ mensagem: 'Código reenviado com sucesso.' });
  } catch (error: any) {
    res.status(500).json({ erro: error.message });
  }
});

export default router;
