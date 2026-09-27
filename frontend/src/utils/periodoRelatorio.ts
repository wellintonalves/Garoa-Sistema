export function validarPeriodoRelatorio(inicio: string, fim: string): string | null {
  if (!inicio && !fim) return null;
  const valida = (valor: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor.startsWith('0000')) return false;
    const data = new Date(`${valor}T12:00:00Z`);
    return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor;
  };
  if (!inicio || !fim) return 'Preencha as duas datas ou limpe ambas para consultar todo o período.';
  if (!valida(inicio) || !valida(fim)) return 'Informe datas completas e válidas.';
  if (inicio > fim) return 'A data inicial deve ser anterior ou igual à data final.';
  return null;
}
