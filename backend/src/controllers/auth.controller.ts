// Controller de autenticação
import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { VerificacaoService } from '../services/verificacao.service';

export class AuthController {
  /** POST /auth/login */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const email = req.body.email?.trim().toLowerCase();
      const senha = req.body.senha;

      if (!email || !senha) {
        res.status(400).json({ erro: 'Email e senha são obrigatórios' });
        return;
      }

      // Portal admin: papel é fixado no servidor, nunca vem do cliente
      const resultado = await AuthService.login({ email, senha, papel: 'ADMIN' });
      res.json(resultado);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao fazer login';
      res.status(401).json({ erro: mensagem });
    }
  }

  /** POST /auth/register */
  static async registrar(req: Request, res: Response): Promise<void> {
    try {
      const { nome, senha, papel, barbeariaId } = req.body;
      const email = req.body.email?.trim().toLowerCase();

      if (!nome || !email || !senha) {
        res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
        return;
      }

      if (senha.length < 6) {
        res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres' });
        return;
      }

      let bId = barbeariaId;
      if (!bId) {
        if (papel === 'ADMIN') {
          const prisma = (await import('../lib/prisma')).prisma;
          // Garante que o novo admin terá uma barbearia criada para ele
          const slugUnico = `barbearia-${Date.now()}`;
          const novaBarbearia = await prisma.barbearia.create({
            data: {
              nome: `Barbearia do ${nome.split(' ')[0]}`,
              slug: slugUnico,
            }
          });
          bId = novaBarbearia.id;
        } else {
          res.status(400).json({ erro: 'Barbearia não informada' });
          return;
        }
      }

      const resultado = await AuthService.registrar({ nome, email, senha, papel, barbeariaId: bId });

      // Envia o código de verificação após criar o usuário
      await VerificacaoService.enviarCodigo(resultado.usuario.id, resultado.usuario.email, resultado.usuario.nome);

      res.status(201).json(resultado);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao registrar';
      res.status(400).json({ erro: mensagem });
    }
  }
}
