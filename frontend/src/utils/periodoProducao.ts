export type PeriodoProducao = 'mes' | 'semana' | 'dia' | 'intervalo';

// Datas civis: aritmética em UTC evita depender do fuso do dispositivo.
export function deslocarDia(dia: string, quantidade: number) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + quantidade);
  return d.toISOString().slice(0, 10);
}
export function periodoProducao(tipo: PeriodoProducao, referencia: string, inicio: string, fim: string) {
  if (tipo === 'intervalo') return { inicio, fim };
  if (tipo === 'dia') return { inicio: referencia, fim: referencia };
  if (tipo === 'mes') {
    const primeiro = `${referencia.slice(0, 7)}-01`;
    const data = new Date(`${primeiro}T12:00:00Z`);
    data.setUTCMonth(data.getUTCMonth() + 1);
    data.setUTCDate(0);
    return { inicio: primeiro, fim: data.toISOString().slice(0, 10) };
  }
  const diaSemana = new Date(`${referencia}T12:00:00Z`).getUTCDay();
  const segunda = deslocarDia(referencia, -((diaSemana + 6) % 7));
  return { inicio: segunda, fim: deslocarDia(segunda, 6) };
}
