import { registrarErroSeguro } from '../lib/logSeguro';
import { Router, Request, Response } from 'express';
import { VerificacaoService } from '../services/verificacao.service';
import { codigoEnvioLimiter, codigoTentativaLimiter } from '../middlewares/rateLimit.middleware';

const router = Router();
const identificadorValido = (valor: unknown): valor is string =>
  typeof valor === 'string' && valor.length > 0 && valor.length <= 100;

async function enviar(req: Request, res: Response) {
  if (!identificadorValido(req.body.usuarioId)) {
    res.status(400).json({ erro: 'Confira os dados e tente novamente.' });
    return;
  }
  try {
    // Campos legados email/nome são ignorados: o serviço resolve o destinatário.
    await VerificacaoService.enviarCodigo(req.body.usuarioId);
    res.json({ mensagem: 'Se a conta precisar de confirmação, o código será enviado ao email cadastrado.' });
  } catch (error) {
    registrarErroSeguro('routes.verificacao.routes.falha', error);
    res.status(500).json({ erro: 'Não foi possível enviar o código. Tente novamente em instantes.' });
  }
}

router.post('/enviar', codigoEnvioLimiter, enviar);
router.post('/reenviar', codigoEnvioLimiter, enviar);
router.post('/confirmar', codigoTentativaLimiter, async (req: Request, res: Response) => {
  const { usuarioId, codigo } = req.body;
  if (!identificadorValido(usuarioId) || typeof codigo !== 'string' || !/^\d{6}$/.test(codigo)) {
    res.status(400).json({ erro: 'Código inválido ou expirado.' });
    return;
  }
  try {
    if (!await VerificacaoService.verificarCodigo(usuarioId, codigo)) {
      res.status(400).json({ erro: 'Código inválido ou expirado.' });
      return;
    }
    res.json({ mensagem: 'Email verificado com sucesso!' });
  } catch (error) {
    registrarErroSeguro('routes.verificacao.routes.falha', error);
    res.status(500).json({ erro: 'Não foi possível confirmar o email. Tente novamente em instantes.' });
  }
});

export default router;
