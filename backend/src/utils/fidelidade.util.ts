/** Soma a regra específica de cada serviço prestado, preservando a ordem dos itens. */
export function somarPontosPorServicos(servicosIds: readonly string[], regras: unknown): number {
  if (!Array.isArray(regras)) return 0;
  return servicosIds.reduce((total, id) => {
    const regra = regras.find((item: unknown) =>
      typeof item === 'object' && item !== null &&
      'servicoId' in item && item.servicoId === id);
    const pontos: unknown = regra?.pontos;
    return total + (typeof pontos === 'number' && Number.isInteger(pontos) && pontos > 0 ? pontos : 0);
  }, 0);
}

export interface ConfiguracaoAcumulo {
  ativo?: boolean;
  regrasPorServico?: unknown;
  pontosPorReal: number;
  pontosPorVisita: number;
  pontosDobroAniversario?: boolean;
}

/** Mesma precedência do crédito: serviços, valor, visita; aniversário dobra o resultado. */
export function calcularPontosAtendimento(
  config: ConfiguracaoAcumulo,
  servicosIds: readonly string[],
  base: number,
  dataNascimento?: Date | null,
  dataReferencia: Date = new Date(),
): number {
  if (config.ativo === false) return 0;
  const especificos = somarPontosPorServicos(servicosIds, config.regrasPorServico);
  const pontos = especificos > 0 ? especificos
    : config.pontosPorReal > 0 && base > 0 ? Math.floor(base * config.pontosPorReal)
    : config.pontosPorVisita;
  const hoje = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', month: '2-digit', day: '2-digit',
  }).format(dataReferencia);
  // Data de nascimento é uma data de calendário armazenada à meia-noite UTC.
  const nascimento = dataNascimento ? new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC', month: '2-digit', day: '2-digit',
  }).format(dataNascimento) : null;
  return Math.max(0, pontos) * (config.pontosDobroAniversario && nascimento === hoje ? 2 : 1);
}
