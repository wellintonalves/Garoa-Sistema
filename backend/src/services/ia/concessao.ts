import { IaConcessao, Prisma, PlanoAssinatura } from '@prisma/client';
import { identificarPeriodoIa } from './periodo';
import { ConfiguracaoConsumoIa } from './configuracaoConsumo';
import { ErroDeNegocio } from '../../lib/erros';

export function concessaoVigente(concessao: IaConcessao | null, barbeariaId: string, agora: Date, custoCreditoMicrousd: number) {
  return Boolean(concessao && concessao.barbeariaId === barbeariaId && !concessao.revogada &&
    concessao.inicio <= agora && agora < concessao.fim && concessao.mensagensLimite > 0 &&
    concessao.mensagensLimite <= 100 && concessao.creditosLimite > 0 && concessao.creditosLimite <= 2_000_000 &&
    concessao.custoCreditoMicrousd === 1 && custoCreditoMicrousd === concessao.custoCreditoMicrousd);
}

/** Fonte de custeio da IA. Não cria/ativa assinaturas nem modifica a liberação geral. */
export async function resolverFranquiaIa(tx: Prisma.TransactionClient, barbeariaId: string, agora: Date, config: ConfiguracaoConsumoIa) {
  const assinatura = await tx.assinaturaSaas.findUnique({ where: { barbeariaId } });
  const periodo = identificarPeriodoIa(assinatura, agora);
  if (assinatura && periodo.estado === 'IDENTIFICADO') return {
    ciclo: periodo, assinaturaId: assinatura.id as string | null, concessaoId: null as string | null,
    plano: assinatura.plano, mensagensLimite: config.mensagens[assinatura.plano], creditosLimite: config.creditos[assinatura.plano],
    vozSegundosLimite: assinatura.plano === 'PRO' ? 1800 : 0,
  };
  const concessao = await tx.iaConcessao.findUnique({ where: { barbeariaId } });
  if (!concessao || !concessaoVigente(concessao, barbeariaId, agora, config.custoCreditoMicrousd)) {
    throw new ErroDeNegocio('A franquia de IA aguarda um ciclo mensal confirmado ou uma concessão gratuita vigente.', 409);
  }
  return {
    ciclo: { inicio: concessao.inicio, fim: concessao.fim, acessoAte: concessao.fim },
    assinaturaId: null as string | null, concessaoId: concessao.id as string | null,
    plano: 'BASICO' as PlanoAssinatura, mensagensLimite: concessao.mensagensLimite,
    creditosLimite: concessao.creditosLimite, vozSegundosLimite: 0,
  };
}
