import { prisma } from '../lib/prisma';
import { ErroDeNegocio } from '../lib/erros';
import { adicionarDias } from '../domain/assinatura/regrasAssinatura';
import type { UsuarioJWT } from '../types';

export class AvisoPagamentoService {
  static async registrar(usuario: UsuarioJWT, agora = new Date()) {
    if (usuario.papel !== 'ADMIN' || !usuario.barbeariaId) throw new ErroDeNegocio('Somente o administrador pode receber este aviso.', 403);
    const autorizado = await prisma.usuario.findFirst({ where: { id: usuario.id, papel: 'ADMIN', barbeariaId: usuario.barbeariaId }, select: { id: true } });
    if (!autorizado) throw new ErroDeNegocio('Administrador autorizado não encontrado.', 403);
    await prisma.assinaturaSaas.updateMany({
      where: { barbeariaId: usuario.barbeariaId, status: 'PAGAMENTO_PENDENTE', avisoPagamentoEm: null, toleranciaAte: null },
      data: { avisoPagamentoEm: agora, toleranciaAte: adicionarDias(agora, 7) },
    });
    const assinatura = await prisma.assinaturaSaas.findUnique({ where: { barbeariaId: usuario.barbeariaId }, select: { status: true, avisoPagamentoEm: true, toleranciaAte: true } });
    return { assinatura };
  }
}
