export function formatarDelta(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return '—';
  const texto = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero',
  }).format(valor);
  return `${texto}%`;
}

export function formatarMoedaCompacta(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return '—';
  return new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL', maximumFractionDigits: 0 }).format(valor);
}

export function formatarMoeda(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return '—';
  return new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(valor);
}

export function formatarInteiro(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return '—';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(valor);
}

export const formatarNumero = formatarInteiro;

export function calcularDelta(atual: number, anterior: number): number | null {
  if (!Number.isFinite(atual) || !Number.isFinite(anterior)) return null;
  if (anterior === 0) return atual === 0 ? 0 : null;
  return ((atual - anterior) / anterior) * 100;
}

export function formatarNomeServico(ag: any, isMobile: boolean = false): string {
  if (ag?.servicosAdicionais && ag.servicosAdicionais.length > 0) {
    if (ag.servicosAdicionais.length === 1) {
      return ag.servicosAdicionais[0].nome;
    }
    if (isMobile || ag.servicosAdicionais.length > 2) {
      return `${ag.servicosAdicionais[0].nome} +${ag.servicosAdicionais.length - 1}`;
    }
    return ag.servicosAdicionais.map((s: any) => s.nome).join(' + ');
  }
  if (ag?.itens && ag.itens.length > 0) {
    return ag.itens.map((i: any) => i.servico?.nome).filter(Boolean).join(' + ');
  }
  return ag?.servico?.nome || 'Serviço';
}
