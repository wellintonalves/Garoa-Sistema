// Serviço de autenticação — login e registro
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { authConfig } from '../config/auth';
import { ErroDeNegocio } from '../lib/erros';
import { Papel, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { UsuarioJWT } from '../types';

interface DadosRegistro {
  nome: string;
  email: string;
  senha: string;
  papel?: Papel;
  barbeariaId?: string;
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
    const email = dados.email.trim().toLowerCase();
    const papel = dados.papel ?? 'CLIENTE';
    if (!email || !Object.values(Papel).includes(papel)) {
      throw new ErroDeNegocio('Dados de cadastro inválidos', 400);
    }
    if (!dados.barbeariaId && papel !== 'ADMIN') {
      throw new ErroDeNegocio('Barbearia não informada', 400);
    }
    const senhaHash = await bcrypt.hash(dados.senha, authConfig.saltRounds);
    const usuario = await prisma.$transaction(async tx => {
      // SERIALIZABLE protege também dois cadastros simultâneos pelo aplicativo.
      // Clientes e barbeiros continuam podendo usar o mesmo email em outras unidades.
      const existentes = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT id FROM usuarios
        WHERE lower(btrim(email)) = ${email}
          AND ((papel = 'ADMIN' AND ${papel} = 'ADMIN')
            OR "barbeariaId" = ${dados.barbeariaId ?? null})
        LIMIT 1
      `);
      if (existentes.length) {
        throw new ErroDeNegocio('Este email já está cadastrado para este acesso. Use outro email ou recupere sua conta.', 409);
      }
      let barbeariaId = dados.barbeariaId;
      if (!barbeariaId) {
        const barbearia = await tx.barbearia.create({
          data: { nome: `Barbearia do ${dados.nome.trim().split(' ')[0]}`, slug: `barbearia-${randomUUID()}` },
        });
        barbeariaId = barbearia.id;
      }
      return tx.usuario.create({
        data: { nome: dados.nome, email, senha: senhaHash, papel, barbeariaId },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code)) {
        throw new ErroDeNegocio('Cadastro em conflito. Tente novamente ou recupere sua conta.', 409);
      }
      throw error;
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
      throw new ErroDeNegocio('Email ou senha incorretos', 401);
    }

    let usuario: (typeof candidatos)[number] | null = null;
    for (const c of candidatos) {
      if (await bcrypt.compare(dados.senha, c.senha)) { usuario = c; break; }
    }

    if (!usuario) {
      throw new ErroDeNegocio('Email ou senha incorretos', 401);
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
