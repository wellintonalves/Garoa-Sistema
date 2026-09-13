/** O sinal preserva também débitos legados que foram gravados como ACUMULO. */
export function tipoMovimentoPontos(pontos: number) {
  return pontos < 0 ? 'RESGATE' as const : 'GANHO' as const;
}

export function resumirPontos(movimentos: { pontos: number }[], resgates: { pontosUsados: number }[]) {
  const totalGanho = movimentos.reduce((s, p) => s + Math.max(0, p.pontos), 0);
  const totalGasto = movimentos.reduce((s, p) => s + Math.max(0, -p.pontos), 0)
    + resgates.reduce((s, r) => s + r.pontosUsados, 0);
  return { totalGanho, totalGasto, saldo: totalGanho - totalGasto };
}
