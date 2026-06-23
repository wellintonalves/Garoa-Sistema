import { PrismaClient } from '@prisma/client';
import { EmailService } from './email.service';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export class VerificacaoService {
  static gerarCodigo(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  static async enviarCodigo(usuarioId: string, email: string, nome: string): Promise<void> {
    console.log('[VerificacaoService] Enviando código para usuário:', usuarioId);
    const codigo = this.gerarCodigo();
    const expiracao = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    await prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        codigoVerificacao: codigo,
        codigoExpiracao: expiracao,
      },
    });

    await EmailService.enviarCodigoVerificacao(email, nome, codigo);
  }

  static async verificarCodigo(usuarioId: string, codigo: string): Promise<boolean> {
    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { codigoVerificacao: true, codigoExpiracao: true },
    });

    if (!usuario?.codigoVerificacao || !usuario?.codigoExpiracao) return false;
    if (usuario.codigoVerificacao !== codigo) return false;
    if (new Date() > usuario.codigoExpiracao) return false;

    await prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        emailVerificado: true,
        codigoVerificacao: null,
        codigoExpiracao: null,
      },
    });

    return true;
  }

  static async enviarCodigoRecuperacao(email: string): Promise<void> {
    const usuario = await prisma.usuario.findFirst({
      where: { email },
    });

    if (!usuario) {
      throw new Error('Email não encontrado.');
    }

    const codigo = this.gerarCodigo();
    const expiracao = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        codigoVerificacao: codigo,
        codigoExpiracao: expiracao,
      },
    });

    await EmailService.enviarCodigoRecuperacaoSenha(email, usuario.nome, codigo);
  }

  static async redefinirSenha(email: string, codigo: string, novaSenha: string): Promise<void> {
    const usuario = await prisma.usuario.findFirst({
      where: { email },
      select: {
        id: true,
        codigoVerificacao: true,
        codigoExpiracao: true,
      },
    });

    if (!usuario?.codigoVerificacao || !usuario?.codigoExpiracao) {
      throw new Error('Código inválido ou expirado.');
    }

    if (usuario.codigoVerificacao !== codigo) {
      throw new Error('Código incorreto.');
    }

    if (new Date() > usuario.codigoExpiracao) {
      throw new Error('Código expirado. Solicite um novo.');
    }

    const senhaHash = await bcrypt.hash(novaSenha, 10);

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        senha: senhaHash,
        codigoVerificacao: null,
        codigoExpiracao: null,
      },
    });
  }
}
