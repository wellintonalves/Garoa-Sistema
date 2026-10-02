import { registrarErroSeguro } from '../lib/logSeguro';
import { Router, Request, Response } from 'express';
import { VerificacaoService } from '../services/verificacao.service';
import { codigoEnvioLimiter, codigoTentativaLimiter } from '../middlewares/rateLimit.middleware';

const router = Router();
const mensagemEnvio = 'Se os dados corresponderem a uma conta, o código será enviado ao email cadastrado.';

router.post('/solicitar', codigoEnvioLimiter, async (req: Request, res: Response) => {
  const { email, papel, barbeariaSlug } = req.body;
  if (typeof email !== 'string' || !email.trim() || email.length > 254) {
    res.status(400).json({ erro: 'Informe um email válido.' });
    return;
  }
  try {
    await VerificacaoService.enviarCodigoRecuperacao(email, { papel, barbeariaSlug });
  } catch (error) {
    // A resposta não revela se uma conta existe, é ambígua ou teve falha de entrega.
    registrarErroSeguro('routes.recuperacao.routes.falha', error);
  }
  res.json({ mensagem: mensagemEnvio });
});

router.post('/redefinir', codigoTentativaLimiter, async (req: Request, res: Response) => {
  const { email, codigo, novaSenha, papel, barbeariaSlug } = req.body;
  if (typeof email !== 'string' || !email.trim() || email.length > 254
    || typeof codigo !== 'string' || !/^\d{6}$/.test(codigo)) {
    res.status(400).json({ erro: 'Código inválido ou expirado.' });
    return;
  }
  if (typeof novaSenha !== 'string' || novaSenha.length < 6 || novaSenha.length > 128) {
    res.status(400).json({ erro: 'A senha deve ter entre 6 e 128 caracteres.' });
    return;
  }
  try {
    await VerificacaoService.redefinirSenha(email, codigo, novaSenha, { papel, barbeariaSlug });
    res.json({ mensagem: 'Senha redefinida com sucesso!' });
  } catch (error) {
    res.status(400).json({ erro: 'Código inválido ou expirado.' });
  }
});

export default router;
