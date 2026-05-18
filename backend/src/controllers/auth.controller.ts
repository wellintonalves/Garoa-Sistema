// Controller de autenticação
import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';

export class AuthController {
  /** POST /auth/login */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, senha } = req.body;

      if (!email || !senha) {
        res.status(400).json({ erro: 'Email e senha são obrigatórios' });
        return;
      }

      const resultado = await AuthService.login({ email, senha });
      res.json(resultado);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao fazer login';
      res.status(401).json({ erro: mensagem });
    }
  }

  /** POST /auth/register */
  static async registrar(req: Request, res: Response): Promise<void> {
    try {
      const { nome, email, senha, papel } = req.body;

      if (!nome || !email || !senha) {
        res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
        return;
      }

      if (senha.length < 6) {
        res.status(400).json({ erro: 'A senha deve ter pelo menos 6 caracteres' });
        return;
      }

      const resultado = await AuthService.registrar({ nome, email, senha, papel });
      res.status(201).json(resultado);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao registrar';
      res.status(400).json({ erro: mensagem });
    }
  }
}
