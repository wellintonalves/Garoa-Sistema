import { calcularFimCiclo } from '../../domain/assinatura/regrasAssinatura';

export const RENOVACAO_IA = 'CICLO_MENSAL_ASSINATURA' as const;
export const FUSO_IA = 'America/Sao_Paulo' as const;

export interface AssinaturaParaPeriodoIa {
  id: string;
  barbeariaId: string;
  periodicidade: 'MENSAL' | 'ANUAL';
  status: string;
  cicloInicio: Date | null;
  cicloFim: Date | null;
  fimAcessoEm: Date | null;
}

export type PeriodoIa = {
  estado: 'IDENTIFICADO';
  // Não depende de plano, hora da requisição ou id do webhook.
  assinaturaId: string;
  barbeariaId: string;
  inicio: Date;
  fim: Date;
  acessoAte: Date;
  acumulaSaldo: false;
} | {
  estado: 'PENDENTE';
  motivo: 'SEM_ASSINATURA' | 'CICLO_INVALIDO' | 'ANUAL_AGUARDA_POLITICA' |
    'TESTE_AGUARDA_POLITICA' | 'PAGAMENTO_AGUARDA_POLITICA' |
    'SEM_CICLO_ATIVO' | 'FORA_DO_CICLO';
};

const dataValida = (data: Date | null): data is Date => data instanceof Date && Number.isFinite(data.getTime());

/** Identifica o período, sem abrir cotas nem conceder acesso ao provedor.
 * O webhook financeiro é quem confirma e persiste cicloInicio/cicloFim.
 * Não somar 30 dias, não avançar ciclo vencido e não usar proximaCobrancaEm.
 */
export function identificarPeriodoIa(assinatura: AssinaturaParaPeriodoIa | null, agora: Date): PeriodoIa {
  if (!dataValida(agora)) throw new Error('Instante de referência inválido.');
  if (!assinatura) return { estado: 'PENDENTE', motivo: 'SEM_ASSINATURA' };
  if (!assinatura.id || !assinatura.barbeariaId) return { estado: 'PENDENTE', motivo: 'CICLO_INVALIDO' };
  if (assinatura.status === 'TESTE') return { estado: 'PENDENTE', motivo: 'TESTE_AGUARDA_POLITICA' };
  if (assinatura.status === 'PAGAMENTO_PENDENTE') return { estado: 'PENDENTE', motivo: 'PAGAMENTO_AGUARDA_POLITICA' };
  if (assinatura.status !== 'ATIVA') return { estado: 'PENDENTE', motivo: 'SEM_CICLO_ATIVO' };
  if (assinatura.periodicidade === 'ANUAL') return { estado: 'PENDENTE', motivo: 'ANUAL_AGUARDA_POLITICA' };
  const { cicloInicio, cicloFim, fimAcessoEm } = assinatura;
  if (!dataValida(cicloInicio) || !dataValida(cicloFim) ||
      (fimAcessoEm !== null && !dataValida(fimAcessoEm)) ||
      calcularFimCiclo(cicloInicio, 'MENSAL').getTime() !== cicloFim.getTime()) {
    return { estado: 'PENDENTE', motivo: 'CICLO_INVALIDO' };
  }
  const acessoAte = fimAcessoEm && fimAcessoEm < cicloFim ? fimAcessoEm : cicloFim;
  if (agora < cicloInicio || agora >= acessoAte) return { estado: 'PENDENTE', motivo: 'FORA_DO_CICLO' };
  return {
    estado: 'IDENTIFICADO', assinaturaId: assinatura.id, barbeariaId: assinatura.barbeariaId,
    inicio: new Date(cicloInicio.getTime()), fim: new Date(cicloFim.getTime()),
    acessoAte: new Date(acessoAte.getTime()), acumulaSaldo: false,
  };
}

/** Snapshot a persistir uma única vez, sob lock e unique de tenant/início.
 * Saldo anterior não participa do cálculo: sobras expiram no próprio período.
 * Repetir esta função não autoriza INSERT, UPDATE ou reset de saldo existente.
 */
export function prepararFranquiaIa(periodo: Extract<PeriodoIa, { estado: 'IDENTIFICADO' }>, limites: {
  mensagens: number; segundosVoz: number; creditos: number | null;
}) {
  for (const valor of [limites.mensagens, limites.segundosVoz, ...(limites.creditos === null ? [] : [limites.creditos])]) {
    if (!Number.isSafeInteger(valor) || valor < 0) throw new Error('Franquia inválida.');
  }
  return {
    barbeariaId: periodo.barbeariaId, assinaturaId: periodo.assinaturaId,
    inicio: new Date(periodo.inicio.getTime()), fim: new Date(periodo.fim.getTime()),
    acumulaSaldo: false as const,
    mensagensLimite: limites.mensagens, segundosVozLimite: limites.segundosVoz,
    creditosLimite: limites.creditos,
    // Nulo mantém consumo bloqueado até a definição de créditos.
    configuracaoCustoPendente: limites.creditos === null,
  };
}
