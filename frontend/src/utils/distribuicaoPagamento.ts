interface Pagamento { id: string; formaPagamento: string; produzido: number }
export function distribuirPagamentos(registros: Pagamento[]) {
  const grupos = new Map<string, number>([['PIX', 0], ['CARTAO', 0], ['DINHEIRO', 0]]);
  const vistos = new Set<string>();
  for (const r of registros) {
    if (vistos.has(r.id)) continue;
    vistos.add(r.id);
    const chave = ['CARTAO_CREDITO', 'CARTAO_DEBITO'].includes(r.formaPagamento) ? 'CARTAO' : r.formaPagamento || 'NAO_INFORMADO';
    grupos.set(chave, (grupos.get(chave) ?? 0) + Math.round(r.produzido * 100));
  }
  const total = [...grupos.values()].reduce((s, v) => s + v, 0);
  const nomes: Record<string, string> = { PIX: 'Pix', CARTAO: 'Cartão', DINHEIRO: 'Dinheiro', NAO_INFORMADO: 'Não informado' };
  return [...grupos].map(([chave, centavos]) => ({ chave, nome: nomes[chave] ?? chave.replaceAll('_', ' ').toLocaleLowerCase('pt-BR'), valor: centavos / 100, percentual: total > 0 ? centavos / total * 100 : 0 }));
}
