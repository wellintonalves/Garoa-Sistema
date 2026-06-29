// Tipos compartilhados do backend
import { Request } from 'express';
import { Papel } from '@prisma/client';

/** Dados do usuário admin extraídos do token JWT */
export interface UsuarioJWT {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  barbeariaId: string | null;
}

/** Dados do cliente extraídos do token JWT */
export interface ClienteJWT {
  clienteId: string;
  usuarioId: string;
  nome: string;
  email: string;
}

/** Dados do barbeiro extraídos do token JWT */
export interface BarbeiroJWT {
  barbeiroId: string;
  usuarioId: string;
  barbeariaId: string;
  nome: string;
  email: string;
}

/** Request com dados do usuário admin autenticado */
export type AuthRequest = Request<any, any, any, any> & {
  usuario?: UsuarioJWT;
};

/** Request com dados do cliente autenticado */
export type ClienteAuthRequest = Request<any, any, any, any> & {
  cliente?: ClienteJWT;
};

/** Request com dados do barbeiro autenticado */
export type BarbeiroAuthRequest = Request<any, any, any, any> & {
  barbeiro?: BarbeiroJWT;
};

/** Resposta padrão de erro */
export interface RespostaErro {
  erro: string;
}

/** Resposta padrão de sucesso */
export interface RespostaSucesso<T> {
  dados: T;
  mensagem?: string;
}
