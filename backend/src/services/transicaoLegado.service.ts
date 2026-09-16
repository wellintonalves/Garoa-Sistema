import { prisma } from '../lib/prisma';
import { ErroDeNegocio } from '../lib/erros';
import { provedorAssinatura, ProvedorAssinatura } from '../integrations/assinaturas/provedorAssinatura';
import type { UsuarioJWT } from '../types';
import { adicionarDias } from '../domain/assinatura/regrasAssinatura';

export function resumirTransicaoLegado(b: any, assinatura: any, disponivel: boolean, agora = new Date()) {
  const legada = Boolean(b?.legadoAssinatura);
  // O primeiro ciclo pago é evidência persistente de migração, mesmo se uma
  // renovação futura falhar. A tolerância comercial não reabre a transição.
  const migrada = assinatura?.status === 'ATIVA' || Boolean(assinatura?.cicloInicio && assinatura?.cicloFim)
    || (!legada && assinatura?.status === 'TESTE');
  const prazo = b?.prazoMigracaoAte ? new Date(b.prazoMigracaoAte) : null;
  const consulta = b?.consultaMigracaoAte ? new Date(b.consultaMigracaoAte) : null;
  const status = !legada ? 'NAO_APLICAVEL' : migrada ? 'MIGRADA'
    : !disponivel ? 'AGUARDANDO_DISPONIBILIDADE'
    : !prazo ? 'AGUARDANDO_AVISO'
    : agora < prazo ? 'PRAZO_MIGRACAO'
    : consulta && agora < consulta ? 'CONSULTA_EXPORTACAO' : 'ENCERRADA';
  return { legada, status, avisoEm: b?.avisoMigracaoEm || null, prazoAte: prazo,
    consultaExportacaoAte: consulta,
    diasRestantes: prazo ? Math.max(0, Math.ceil((prazo.getTime() - agora.getTime()) / 86400000)) : null,
    elegivelTeste: !legada };
}

export class TransicaoLegadoService {
  static async resumo(barbeariaId: string, assinatura: any, provedor: ProvedorAssinatura = provedorAssinatura, agora = new Date()) {
    const b = await prisma.barbearia.findUnique({ where: { id: barbeariaId } });
    return resumirTransicaoLegado(b, assinatura, provedor.configurado, agora);
  }

  /** Chamado somente depois que o aviso foi exibido ao administrador; nunca por GET/login. */
  static async registrarAviso(usuario: UsuarioJWT, provedor: ProvedorAssinatura = provedorAssinatura, agora = new Date()) {
    if (!usuario.barbeariaId || usuario.papel !== 'ADMIN') throw new ErroDeNegocio('Somente o administrador pode confirmar o aviso.', 403);
    const admin = await prisma.usuario.findFirst({ where: { id: usuario.id, papel: 'ADMIN', barbeariaId: usuario.barbeariaId }, select: { id: true } });
    if (!admin) throw new ErroDeNegocio('Administrador autorizado não encontrado.', 403);
    const assinatura = await prisma.assinaturaSaas.findUnique({ where: { barbeariaId: usuario.barbeariaId } });
    const estadoAtual = await this.resumo(usuario.barbeariaId, assinatura, provedor, agora);
    if (provedor.configurado && estadoAtual.status === 'AGUARDANDO_AVISO') {
      const prazo = adicionarDias(agora, 5);
      await prisma.barbearia.updateMany({
        where: { id: usuario.barbeariaId, legadoAssinatura: true, avisoMigracaoEm: null },
        data: { avisoMigracaoEm: agora, prazoMigracaoAte: prazo, consultaMigracaoAte: adicionarDias(prazo, 30) },
      });
    }
    return this.resumo(usuario.barbeariaId, assinatura, provedor, agora);
  }
}
