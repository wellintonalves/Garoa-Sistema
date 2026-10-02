import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { authConfig } from '../config/auth';
import { prisma } from '../lib/prisma';
import { EmailService } from './email.service';

type Finalidade = 'verificacao' | 'recuperacao';
export interface ContextoRecuperacao {
  papel?: 'ADMIN' | 'CLIENTE' | 'BARBEIRO';
  barbeariaSlug?: string;
}

type Desafio = {
  v: 1;
  finalidade: Finalidade;
  nonce: string;
  resumo: string;
  emitidoEm: number;
  tentativas: number;
  envios: number;
};

const DURACAO = 10 * 60 * 1000;
const INTERVALO_ENVIO = 60 * 1000;
const MAX_TENTATIVAS = 5;
const MAX_ENVIOS = 3;
const INVALIDO = 'Código inválido ou expirado.';
const camposUsuario = {
  id: true, email: true, nome: true, barbeariaId: true, emailVerificado: true,
  codigoVerificacao: true, codigoExpiracao: true,
} satisfies Prisma.UsuarioSelect;
type Identidade = Prisma.UsuarioGetPayload<{ select: typeof camposUsuario }>;

function lerDesafio(valor: string | null): Desafio | null {
  if (!valor) return null;
  try {
    const d = JSON.parse(valor) as Desafio;
    if (d.v !== 1 || !['verificacao', 'recuperacao'].includes(d.finalidade)
      || !/^[a-f0-9]{32}$/.test(d.nonce) || !/^[a-f0-9]{64}$/.test(d.resumo)
      || !Number.isSafeInteger(d.emitidoEm) || d.emitidoEm < 0
      || !Number.isInteger(d.tentativas) || d.tentativas < 0 || d.tentativas > MAX_TENTATIVAS
      || !Number.isInteger(d.envios) || d.envios < 1 || d.envios > MAX_ENVIOS) return null;
    return d;
  } catch { return null; }
}

function resumoCodigo(usuario: Identidade, d: Pick<Desafio, 'finalidade' | 'nonce'>, expiracao: Date, codigo: string) {
  return createHmac('sha256', authConfig.secret)
    .update(JSON.stringify(['codigo-conta-v1', d.finalidade, usuario.id,
      usuario.email.trim().toLowerCase(), usuario.barbeariaId, expiracao.getTime(), d.nonce, codigo]))
    .digest('hex');
}

// Compara o estado inteiro: concorrência, reenvio ou alteração de identidade
// nunca podem consumir/substituir um desafio que foi lido anteriormente.
function estadoAtual(usuario: Identidade): Prisma.UsuarioWhereInput {
  return {
    id: usuario.id, email: usuario.email, barbeariaId: usuario.barbeariaId,
    codigoVerificacao: usuario.codigoVerificacao, codigoExpiracao: usuario.codigoExpiracao,
  };
}

export class VerificacaoService {
  static async enviarCodigo(usuarioId: string): Promise<void> {
    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: camposUsuario });
    if (!usuario || usuario.emailVerificado) return;
    await this.emitir(usuario, 'verificacao');
  }

  private static async emitir(usuario: Identidade, finalidade: Finalidade): Promise<void> {
    const agora = Date.now();
    const anterior = lerDesafio(usuario.codigoVerificacao);
    const emVigor = anterior && usuario.codigoExpiracao && usuario.codigoExpiracao.getTime() > agora;
    if (emVigor && (agora - anterior.emitidoEm < INTERVALO_ENVIO
      || anterior.envios >= MAX_ENVIOS || anterior.tentativas >= MAX_TENTATIVAS)) return;

    // Reenvios compartilham o orçamento e o fim da janela, inclusive ao trocar finalidade.
    const expiracao = emVigor ? usuario.codigoExpiracao! : new Date(agora + DURACAO);
    const codigo = randomInt(0, 1000000).toString().padStart(6, '0');
    const desafio: Desafio = {
      v: 1, finalidade, nonce: randomBytes(16).toString('hex'), resumo: '', emitidoEm: agora,
      tentativas: emVigor ? anterior.tentativas : 0,
      envios: emVigor ? anterior.envios + 1 : 1,
    };
    desafio.resumo = resumoCodigo(usuario, desafio, expiracao, codigo);
    const atualizado = await prisma.usuario.updateMany({
      where: { ...estadoAtual(usuario), ...(finalidade === 'verificacao' ? { emailVerificado: false } : {}) },
      data: { codigoVerificacao: JSON.stringify(desafio), codigoExpiracao: expiracao },
    });
    if (atualizado.count !== 1) return;

    // Destino e nome são sempre da identidade persistida, nunca da requisição.
    if (finalidade === 'verificacao') {
      await EmailService.enviarCodigoVerificacao(usuario.email, usuario.nome, codigo);
    } else {
      await EmailService.enviarCodigoRecuperacaoSenha(usuario.email, usuario.nome, codigo);
    }
  }

  private static async conferir(usuario: Identidade | null, finalidade: Finalidade, codigo: string): Promise<Identidade | null> {
    if (!usuario || typeof codigo !== 'string' || !/^\d{6}$/.test(codigo)) return null;
    const desafio = lerDesafio(usuario.codigoVerificacao);
    if (!desafio || desafio.finalidade !== finalidade || !usuario.codigoExpiracao
      || usuario.codigoExpiracao.getTime() <= Date.now() || desafio.tentativas >= MAX_TENTATIVAS) return null;

    // Reserve a tentativa antes de comparar: requisições paralelas perdedoras
    // não podem testar vários palpites contra o mesmo orçamento.
    const reservado = JSON.stringify({ ...desafio, tentativas: desafio.tentativas + 1 });
    const tentativa = await prisma.usuario.updateMany({
      where: { ...estadoAtual(usuario), AND: { codigoExpiracao: { gt: new Date() } } },
      data: { codigoVerificacao: reservado },
    });
    if (tentativa.count !== 1) return null;
    const esperado = resumoCodigo(usuario, desafio, usuario.codigoExpiracao, codigo);
    return timingSafeEqual(Buffer.from(esperado, 'hex'), Buffer.from(desafio.resumo, 'hex'))
      ? { ...usuario, codigoVerificacao: reservado } : null;
  }

  static async verificarCodigo(usuarioId: string, codigo: string): Promise<boolean> {
    const encontrado = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: camposUsuario });
    const usuario = await this.conferir(encontrado, 'verificacao', codigo);
    if (!usuario) return false;
    const resultado = await prisma.usuario.updateMany({
      where: { ...estadoAtual(usuario), emailVerificado: false, AND: { codigoExpiracao: { gt: new Date() } } },
      data: { emailVerificado: true, codigoVerificacao: null, codigoExpiracao: null },
    });
    return resultado.count === 1;
  }

  private static async buscarRecuperacao(email: string, contexto: ContextoRecuperacao): Promise<Identidade | null> {
    if (typeof email !== 'string' || email.length > 254 || !email.trim()
      || (contexto.papel !== undefined && !['ADMIN', 'CLIENTE', 'BARBEIRO'].includes(contexto.papel))
      || (contexto.barbeariaSlug !== undefined && (typeof contexto.barbeariaSlug !== 'string'
        || !contexto.barbeariaSlug.trim() || contexto.barbeariaSlug.length > 100))) return null;
    const slug = contexto.barbeariaSlug?.trim().toLowerCase();
    const usuarios = await prisma.usuario.findMany({
      where: {
        email: { equals: email.trim().toLowerCase(), mode: 'insensitive' },
        ...(contexto.papel ? { papel: contexto.papel } : {}),
        ...(slug ? { barbearia: { slug } } : contexto.papel === 'CLIENTE' ? { barbeariaId: null } : {}),
      },
      select: camposUsuario, take: 2,
    });
    // Emails podem ser compartilhados por contas distintas. Nunca escolha a primeira.
    return usuarios.length === 1 ? usuarios[0] : null;
  }

  static async enviarCodigoRecuperacao(email: string, contexto: ContextoRecuperacao = {}): Promise<void> {
    const usuario = await this.buscarRecuperacao(email, contexto);
    if (usuario) await this.emitir(usuario, 'recuperacao');
  }

  static async redefinirSenha(email: string, codigo: string, novaSenha: string, contexto: ContextoRecuperacao = {}): Promise<void> {
    if (typeof novaSenha !== 'string' || novaSenha.length < 6 || novaSenha.length > 128) {
      throw new Error('A senha deve ter entre 6 e 128 caracteres.');
    }
    const encontrado = await this.buscarRecuperacao(email, contexto);
    const usuario = await this.conferir(encontrado, 'recuperacao', codigo);
    if (!usuario) throw new Error(INVALIDO);
    const senhaHash = await bcrypt.hash(novaSenha, authConfig.saltRounds);
    const resultado = await prisma.usuario.updateMany({
      where: { ...estadoAtual(usuario), AND: { codigoExpiracao: { gt: new Date() } } },
      data: { senha: senhaHash, codigoVerificacao: null, codigoExpiracao: null },
    });
    if (resultado.count !== 1) throw new Error(INVALIDO);
  }
}
