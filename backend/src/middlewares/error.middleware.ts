import { Request, Response, NextFunction } from 'express';
import { ErroDeNegocio } from '../lib/erros';

function gerarCodigoReferencia(): string {
  return 'ERR-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ErroDeNegocio || err.name === 'ErroDeNegocio') {
    const status = (err as any).status || 400;
    res.status(status).json({ erro: err.message });
    return;
  }

  const ref = gerarCodigoReferencia();
  console.error(`[${ref}]`, err);

  res.status(500).json({ 
    erro: 'Não foi possível concluir a operação. Tente novamente em instantes.',
    referencia: ref
  });
}
