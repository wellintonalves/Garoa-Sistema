// Tipos compartilhados do backend
import { Request } from 'express';
import { Papel } from '@prisma/client';

/** Dados do usuário extraídos do token JWT */
export interface UsuarioJWT {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  barbeariaId: string;
}

/** Request com dados do usuário autenticado */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface AuthRequest extends Request<Record<string, string>, any, any> {
  usuario?: UsuarioJWT;
}

/** Resposta padrão de erro */
export interface RespostaErro {
  erro: string;
}

/** Resposta padrão de sucesso */
export interface RespostaSucesso<T> {
  dados: T;
  mensagem?: string;
}

