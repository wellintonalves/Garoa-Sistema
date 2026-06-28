// Serviço de chat entre cliente e barbearia
import { prisma } from '../lib/prisma';

export class ChatService {
  // ─── Cliente ───────────────────────────────────────────────────────────────

  /** Retorna histórico de mensagens entre cliente e barbearia */
  static async getMensagens(clienteId: string, barbeariaId: string) {
    // Marca como lidas as mensagens do admin para o cliente
    await prisma.chatMensagem.updateMany({
      where: { clienteId, barbeariaId, remetente: 'ADMIN', lida: false },
      data: { lida: true },
    });

    return prisma.chatMensagem.findMany({
      where: { clienteId, barbeariaId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        texto: true,
        remetente: true,
        lida: true,
        createdAt: true,
      },
    });
  }

  /** Cliente envia mensagem */
  static async clienteEnviar(clienteId: string, barbeariaId: string, texto: string) {
    return prisma.chatMensagem.create({
      data: { clienteId, barbeariaId, texto, remetente: 'CLIENTE' },
      select: { id: true, texto: true, remetente: true, lida: true, createdAt: true },
    });
  }

  // ─── Admin ─────────────────────────────────────────────────────────────────

  /** Lista todas as conversas da barbearia (uma por cliente, com último mensagem e contagem de não lidas) */
  static async listarConversas(barbeariaId: string) {
    // Busca clientes que já enviaram ou receberam alguma mensagem nesta barbearia
    const conversas = await prisma.chatMensagem.findMany({
      where: { barbeariaId },
      distinct: ['clienteId'],
      orderBy: { createdAt: 'desc' },
      select: { clienteId: true },
    });

    const resultado = await Promise.all(
      conversas.map(async ({ clienteId }) => {
        const [ultima, naoLidas, cliente] = await Promise.all([
          prisma.chatMensagem.findFirst({
            where: { clienteId, barbeariaId },
            orderBy: { createdAt: 'desc' },
            select: { texto: true, remetente: true, createdAt: true },
          }),
          prisma.chatMensagem.count({
            where: { clienteId, barbeariaId, remetente: 'CLIENTE', lida: false },
          }),
          prisma.cliente.findUnique({
            where: { id: clienteId },
            select: { id: true, usuario: { select: { nome: true, email: true } } },
          }),
        ]);

        return {
          clienteId,
          clienteNome: cliente?.usuario.nome ?? 'Cliente',
          clienteEmail: cliente?.usuario.email ?? '',
          ultimaMensagem: ultima?.texto ?? '',
          ultimaAt: ultima?.createdAt ?? new Date(),
          ultimoRemetente: ultima?.remetente ?? 'CLIENTE',
          naoLidas,
        };
      })
    );

    // Ordena por mais recente
    return resultado.sort((a, b) => new Date(b.ultimaAt).getTime() - new Date(a.ultimaAt).getTime());
  }

  /** Admin busca mensagens de um cliente específico */
  static async adminGetMensagens(barbeariaId: string, clienteId: string) {
    // Marca como lidas as mensagens do cliente para o admin
    await prisma.chatMensagem.updateMany({
      where: { clienteId, barbeariaId, remetente: 'CLIENTE', lida: false },
      data: { lida: true },
    });

    return prisma.chatMensagem.findMany({
      where: { clienteId, barbeariaId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        texto: true,
        remetente: true,
        lida: true,
        createdAt: true,
      },
    });
  }

  /** Admin envia mensagem para cliente */
  static async adminEnviar(barbeariaId: string, clienteId: string, texto: string) {
    return prisma.chatMensagem.create({
      data: { clienteId, barbeariaId, texto, remetente: 'ADMIN' },
      select: { id: true, texto: true, remetente: true, lida: true, createdAt: true },
    });
  }

  /** Contagem de mensagens não lidas (de clientes) para o admin */
  static async totalNaoLidas(barbeariaId: string) {
    return prisma.chatMensagem.count({
      where: { barbeariaId, remetente: 'CLIENTE', lida: false },
    });
  }
}
