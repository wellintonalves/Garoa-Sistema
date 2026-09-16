import { prisma } from '../lib/prisma';
import { ErroDeNegocio } from '../lib/erros';
import { podeEscreverNaAssinatura, podeLerNaAssinatura } from '../domain/assinatura/regrasAssinatura';
import { TransicaoLegadoService } from './transicaoLegado.service';

const METODOS_LEITURA = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function validarEscritaAssinatura(
  barbeariaId: string,
  metodo: string,
  caminho: string,
): Promise<void> {
  if (caminho.split('?')[0] === '/dev/checkout-local/confirmar'
    && process.env.NODE_ENV === 'development' && process.env.ASSINATURA_PROVEDOR === 'fake'
    && process.env.ASSINATURA_FAKE_LOCAL_ENABLED === 'true') return;
  // Cancelar renovação e consultar o próprio estado permanecem acessíveis.
  const rotaAssinatura = /^\/(?:api\/)?assinatura(?:\/|\?|$)/.test(caminho);
  const exportacao = /^\/(?:api\/)?assinatura\/exportacao(?:\?|$)/.test(caminho);
  if (rotaAssinatura && !exportacao) return;

  const assinatura = await prisma.assinaturaSaas.findUnique({
    where: { barbeariaId },
    select: { status: true, fimAcessoEm: true, testeFim: true, cicloInicio: true, cicloFim: true,
      ultimaCobrancaExternaId: true, avisoPagamentoEm: true, toleranciaAte: true, consultaExportacaoAte: true },
  });
  const transicao = await TransicaoLegadoService.resumo(barbeariaId, assinatura);
  if (transicao.status === 'ENCERRADA' ||
    (transicao.status === 'CONSULTA_EXPORTACAO' && !METODOS_LEITURA.has(metodo.toUpperCase()))) {
    throw new ErroDeNegocio('O prazo de cinco dias para escolher um plano terminou. Acesse Assinatura para regularizar o acesso.', 403);
  }
  // Durante a transição, checkout pendente não encurta o prazo do aviso.
  if (transicao.legada && transicao.status !== 'MIGRADA') return;
  if (!assinatura) return;

  if (METODOS_LEITURA.has(metodo.toUpperCase())) {
    if (!podeLerNaAssinatura({ ...assinatura, agora: new Date() })) {
      throw new ErroDeNegocio('O período de acesso aos dados terminou. Acesse Assinatura para regularizar o acesso.', 403);
    }
    return;
  }

  if (!podeEscreverNaAssinatura({
    ...assinatura,
    agora: new Date(),
  })) {
    throw new ErroDeNegocio('A assinatura está no período de consulta e exportação. Alterações estão bloqueadas.', 403);
  }
}
