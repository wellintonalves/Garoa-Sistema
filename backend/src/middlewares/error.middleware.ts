// Middleware global de tratamento de erros
import { Request, Response, NextFunction } from 'express';

/** Captura erros não tratados e retorna resposta padronizada */
export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[ERRO]', err);

  // Erro de validação do Prisma
  if (err.name === 'PrismaClientKnownRequestError') {
    res.status(400).json({ erro: 'Erro na operação do banco de dados' });
    return;
  }

  // Erro de validação
  if (err.name === 'ValidationError') {
    res.status(400).json({ erro: err.message });
    return;
  }

  // Erro genérico
  res.status(500).json({ erro: 'Erro interno do servidor' });
}
