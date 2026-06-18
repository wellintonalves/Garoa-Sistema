import { PrismaClient } from '@prisma/client';
import { EmailService } from './email.service';

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
}
