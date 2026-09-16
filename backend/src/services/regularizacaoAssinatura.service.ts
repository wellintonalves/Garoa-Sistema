import { isIP } from 'node:net';
import { prisma } from '../lib/prisma';
import { ErroDeNegocio } from '../lib/erros';
import type { UsuarioJWT } from '../types';
import { provedorAssinatura, type ProvedorAssinatura } from '../integrations/assinaturas/provedorAssinatura';
import { EVENTOS_REVERSAO, mensagemRevisaoFinanceira } from '../domain/assinatura/eventosFinanceiros';

export async function obterRevisaoFinanceira(assinatura: { id: string; ultimaCobrancaExternaId: string | null; cicloFim?: Date | null }) {
  const eventos = await prisma.eventoWebhookAsaas.findMany({
    where: { resumo: { path: ['assinaturaLocalId'], equals: assinatura.id }, tipo: { in: EVENTOS_REVERSAO }, status: 'PROCESSADO' },
    orderBy: [{ ocorridoEm: 'desc' }, { recebidoEm: 'desc' }],
  });
  const evento = eventos.find(e => {
    const resumo = e.resumo as Record<string, unknown>;
    const vigente = e.recursoExternoId === assinatura.ultimaCobrancaExternaId ||
      (resumo.revisaoUpgrade === true && resumo.cicloFimRevisao === assinatura.cicloFim?.toISOString()) ||
      !assinatura.ultimaCobrancaExternaId;
    return vigente && resumo.assinaturaLocalId === assinatura.id && resumo.revisaoResolvida !== true;
  });
  return evento ? { tipo: evento.tipo, mensagem: mensagemRevisaoFinanceira(evento.tipo) } : null;
}

export class RegularizacaoAssinaturaService {
  private static async assinaturaAutorizada(usuario: UsuarioJWT) {
    if (usuario.papel !== 'ADMIN' || !usuario.barbeariaId) throw new ErroDeNegocio('Somente o administrador pode gerenciar pagamentos.', 403);
    const admin = await prisma.usuario.findFirst({ where: { id: usuario.id, papel: 'ADMIN', barbeariaId: usuario.barbeariaId }, select: { id: true } });
    if (!admin) throw new ErroDeNegocio('Administrador não autorizado.', 403);
    const assinatura = await prisma.assinaturaSaas.findUnique({ where: { barbeariaId: usuario.barbeariaId } });
    if (!assinatura?.assinaturaExternaId || !assinatura.clienteExternoId || !assinatura.ultimaCobrancaExternaId) throw new ErroDeNegocio('A cobrança ainda não foi identificada. Atualize a página ou consulte o suporte.', 409);
    return assinatura;
  }

  static async obter(usuario: UsuarioJWT, provedor: ProvedorAssinatura = provedorAssinatura) {
    const assinatura = await this.assinaturaAutorizada(usuario);
    const revisao = await obterRevisaoFinanceira(assinatura);
    if (revisao) return { estado: 'EM_REVISAO', mensagem: revisao.mensagem, invoiceUrl: null };
    if (!provedor.configurado || !provedor.consultarCobranca) throw new ErroDeNegocio('A consulta de pagamentos está indisponível. Consulte o suporte.', 503);
    const resultado = await provedor.consultarCobranca({
      cobrancaExternaId: assinatura.ultimaCobrancaExternaId!, assinaturaExternaId: assinatura.assinaturaExternaId!, clienteExternoId: assinatura.clienteExternoId!,
    });
    if (resultado.estado !== 'CONFIRMADO') throw new ErroDeNegocio(resultado.mensagem, 502);
    if (!['PENDING', 'OVERDUE', 'CONFIRMED', 'RECEIVED'].includes(resultado.status || '') || !resultado.invoiceUrl) {
      return { estado: 'EM_REVISAO', mensagem: 'Esta cobrança não está disponível para pagamento. Consulte o suporte.', invoiceUrl: null };
    }
    return { estado: ['CONFIRMED', 'RECEIVED'].includes(resultado.status!) ? 'PAGA' : 'PENDENTE', invoiceUrl: resultado.invoiceUrl,
      mensagem: 'Confira a fatura no Asaas. O acesso será atualizado após a confirmação do pagamento.' };
  }

  static async usarCartao(usuario: UsuarioJWT, aceite: unknown, remoteIp: string, provedor: ProvedorAssinatura = provedorAssinatura) {
    if (aceite !== true) throw new ErroDeNegocio('Confirme o uso do cartão da última fatura nas próximas renovações.');
    if (!isIP(remoteIp)) throw new ErroDeNegocio('Não foi possível identificar a conexão do pagador.');
    const assinatura = await this.assinaturaAutorizada(usuario);
    if (!assinatura.renovacaoAutomatica || assinatura.status !== 'ATIVA' || await obterRevisaoFinanceira(assinatura)) throw new ErroDeNegocio('A assinatura precisa estar ativa e sem pagamento em revisão.', 409);
    if (!provedor.configurado || !provedor.usarCartaoDaCobranca) throw new ErroDeNegocio('A atualização do cartão está indisponível. Consulte o suporte.', 503);
    const resultado = await provedor.usarCartaoDaCobranca({
      cobrancaExternaId: assinatura.ultimaCobrancaExternaId!, assinaturaExternaId: assinatura.assinaturaExternaId!, clienteExternoId: assinatura.clienteExternoId!, remoteIp,
    });
    if (resultado.estado !== 'CONFIRMADO') throw new ErroDeNegocio(resultado.mensagem, resultado.estado === 'FALHA' ? 409 : 502);
    return { mensagem: resultado.mensagem };
  }
}
