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
  papel?: Papel;
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
    const emailNormalizado = String(dados.email).trim().toLowerCase();

    const candidatos = await prisma.usuario.findMany({
      where: {
        email: { equals: emailNormalizado, mode: 'insensitive' },
        ...(dados.barbeariaId ? { barbeariaId: dados.barbeariaId } : {}),
        ...(dados.papel ? { papel: dados.papel } : {}),
      },
    });

    if (candidatos.length === 0) {
      throw new Error('Email ou senha incorretos');
    }

    let usuario: any = null;
    for (const c of candidatos) {
      if (await bcrypt.compare(dados.senha, c.senha)) { usuario = c; break; }
    }

    if (!usuario) {
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
