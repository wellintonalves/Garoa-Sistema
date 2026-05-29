// Serviço de autenticação — login e registro
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { authConfig } from '../config/auth';
import { Papel } from '@prisma/client';
import { UsuarioJWT } from '../types';

interface DadosRegistro {
  nome: string;
  email: string;
  senha: string;
  papel?: Papel;
  barbeariaId: string;
}

interface DadosLogin {
  email: string;
  senha: string;
  barbeariaId?: string;
}

interface RespostaAuth {
  token: string;
  usuario: UsuarioJWT;
}

export class AuthService {
  /** Registra um novo usuário */
  static async registrar(dados: DadosRegistro): Promise<RespostaAuth> {
    // Verifica se email já existe na barbearia
    const existente = await prisma.usuario.findUnique({
      where: { email_barbeariaId: { email: dados.email, barbeariaId: dados.barbeariaId } },
    });

    if (existente) {
      throw new Error('Este email já está cadastrado');
    }

    // Hash da senha
    const senhaHash = await bcrypt.hash(dados.senha, authConfig.saltRounds);

    // Cria o usuário
    const usuario = await prisma.usuario.create({
      data: {
        nome: dados.nome,
        email: dados.email,
        senha: senhaHash,
        papel: dados.papel || 'CLIENTE',
        barbeariaId: dados.barbeariaId,
      } as any,
    });

    // Gera o token
    const payload: UsuarioJWT = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
      barbeariaId: usuario.barbeariaId,
    };

    const token = jwt.sign(
      { ...payload },
      authConfig.secret as jwt.Secret,
      { expiresIn: authConfig.expiresIn } as jwt.SignOptions
    );

    return { token, usuario: payload };
  }

  /** Autentica um usuário existente */
  static async login(dados: DadosLogin): Promise<RespostaAuth> {
    // Busca o usuário (se barbeariaId for fornecido, busca exato, senão pega o primeiro)
    const whereClause = dados.barbeariaId 
      ? { email_barbeariaId: { email: dados.email, barbeariaId: dados.barbeariaId } }
      : { email: dados.email };

    const usuario = await prisma.usuario.findFirst({
      where: whereClause,
    });

    if (!usuario) {
      throw new Error('Email ou senha incorretos');
    }

    // Verifica a senha
    const senhaValida = await bcrypt.compare(dados.senha, usuario.senha);

    if (!senhaValida) {
      throw new Error('Email ou senha incorretos');
    }

    // Gera o token
    const payload: UsuarioJWT = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
      barbeariaId: usuario.barbeariaId,
    };

    const token = jwt.sign(
      { ...payload },
      authConfig.secret as jwt.Secret,
      { expiresIn: authConfig.expiresIn } as jwt.SignOptions
    );

    return { token, usuario: payload };
  }
}
