export type PlanoAssinaturaCodigo = 'BASICO' | 'PRO';
export type PeriodicidadeAssinaturaCodigo = 'MENSAL' | 'ANUAL';

export const PRECOS_ASSINATURA_CENTAVOS = {
  BASICO: { MENSAL: 3999, ANUAL: 39990 },
  PRO: { MENSAL: 6999, ANUAL: 69990 },
} as const;

export const LIMITES_PLANO_BASICO = {
  barbeirosAtivos: 8,
  clientesAtivos: 200,
  avisoClientesAtivos: 180,
} as const;

const DIA_MS = 24 * 60 * 60 * 1000;

function exigirDataValida(data: Date, campo: string): void {
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) {
    throw new Error(`${campo} inválido.`);
  }
}

export function adicionarDias(data: Date, dias: number): Date {
  exigirDataValida(data, 'Data');
  return new Date(data.getTime() + dias * DIA_MS);
}

export function calcularFimTeste(inicio: Date): Date {
  return adicionarDias(inicio, 7);
}

export function calcularFimConsultaExportacao(fimAcesso: Date): Date {
  return adicionarDias(fimAcesso, 30);
}

export function calcularFimCiclo(
  inicio: Date,
  periodicidade: PeriodicidadeAssinaturaCodigo,
): Date {
  exigirDataValida(inicio, 'Início do ciclo');
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const valores = (data: Date) => Object.fromEntries(partes.formatToParts(data).map(p => [p.type, Number(p.value)]));
  const origem = valores(inicio);
  const anoDestino = origem.year + (periodicidade === 'ANUAL' ? 1 : 0);
  const mesDestino = origem.month - 1 + (periodicidade === 'MENSAL' ? 1 : 0);
  const ultimoDiaDestino = new Date(Date.UTC(anoDestino, mesDestino + 1, 0)).getUTCDate();
  const parede = Date.UTC(
    anoDestino,
    mesDestino,
    Math.min(origem.day, ultimoDiaDestino),
    origem.hour,
    origem.minute,
    origem.second,
    inicio.getUTCMilliseconds(),
  );
  let instante = parede;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const alvo = valores(new Date(instante));
    const representacao = Date.UTC(alvo.year, alvo.month - 1, alvo.day, alvo.hour, alvo.minute, alvo.second, inicio.getUTCMilliseconds());
    const corrigido = instante + parede - representacao;
    if (corrigido === instante) break;
    instante = corrigido;
  }
  return new Date(instante);
}

export function obterPrecoCiclo(
  plano: PlanoAssinaturaCodigo,
  periodicidade: PeriodicidadeAssinaturaCodigo,
): number {
  return PRECOS_ASSINATURA_CENTAVOS[plano][periodicidade];
}

export function avaliarMudancaPeriodicidade(input: {
  plano: PlanoAssinaturaCodigo;
  periodicidadeAtual: PeriodicidadeAssinaturaCodigo;
  periodicidadeDestino: PeriodicidadeAssinaturaCodigo;
  chegouRenovacao: boolean;
}) {
  if (input.periodicidadeAtual === input.periodicidadeDestino) {
    throw new Error('A periodicidade de destino deve ser diferente da atual.');
  }
  return {
    precoAtualCentavos: obterPrecoCiclo(input.plano, input.periodicidadeAtual),
    precoDestinoCentavos: obterPrecoCiclo(input.plano, input.periodicidadeDestino),
    acao: input.chegouRenovacao ? 'EFETIVAR_NA_RENOVACAO' as const : 'AGENDAR_PARA_RENOVACAO' as const,
  };
}

export function deveAvisarLimiteClientes(clientesAtivos: number): boolean {
  return clientesAtivos >= LIMITES_PLANO_BASICO.avisoClientesAtivos &&
    clientesAtivos < LIMITES_PLANO_BASICO.clientesAtivos;
}

export function calcularUpgradeProporcional(input: {
  planoAtual: PlanoAssinaturaCodigo;
  planoDestino: PlanoAssinaturaCodigo;
  periodicidade: PeriodicidadeAssinaturaCodigo;
  cicloInicio: Date;
  cicloFim: Date;
  agora: Date;
  cicloPago: boolean;
}): { valorAdicionalCentavos: number; fracaoRestante: number } {
  const { cicloInicio, cicloFim, agora } = input;
  [cicloInicio, cicloFim, agora].forEach((data, indice) =>
    exigirDataValida(data, ['Início do ciclo', 'Fim do ciclo', 'Data atual'][indice]),
  );
  if (!input.cicloPago) {
    throw new Error('O upgrade proporcional exige um ciclo já pago.');
  }
  if (input.planoAtual !== 'BASICO' || input.planoDestino !== 'PRO') {
    throw new Error('A prévia proporcional é exclusiva do upgrade do Básico para o Pró.');
  }
  const duracao = cicloFim.getTime() - cicloInicio.getTime();
  if (duracao <= 0 || agora < cicloInicio || agora > cicloFim) {
    throw new Error('Período pago inválido para calcular o upgrade.');
  }

  const restante = Math.max(0, cicloFim.getTime() - agora.getTime());
  const fracaoRestante = restante / duracao;
  const diferenca =
    obterPrecoCiclo('PRO', input.periodicidade) -
    obterPrecoCiclo('BASICO', input.periodicidade);

  return {
    valorAdicionalCentavos: Math.round(diferenca * fracaoRestante),
    fracaoRestante,
  };
}

export function avaliarDowngradeParaBasico(input: {
  barbeirosAtivos: number;
  clientesAtivos: number;
  chegouRenovacao: boolean;
}): {
  enquadrada: boolean;
  acao: 'AGENDAR_DOWNGRADE' | 'EFETIVAR_DOWNGRADE' | 'ENCERRAR_RENOVACAO';
  excedentes: { barbeiros: number; clientes: number };
} {
  const excedentes = {
    barbeiros: Math.max(0, input.barbeirosAtivos - LIMITES_PLANO_BASICO.barbeirosAtivos),
    clientes: Math.max(0, input.clientesAtivos - LIMITES_PLANO_BASICO.clientesAtivos),
  };
  const enquadrada = excedentes.barbeiros === 0 && excedentes.clientes === 0;
  return {
    enquadrada,
    acao: input.chegouRenovacao
      ? enquadrada
        ? 'EFETIVAR_DOWNGRADE'
        : 'ENCERRAR_RENOVACAO'
      : 'AGENDAR_DOWNGRADE',
    excedentes,
  };
}

export function avaliarPagamentoRecusado(input: {
  avisoEnviadoEm: Date;
  agora: Date;
  fatura: 'PENDENTE' | 'PAGA' | 'CANCELADA';
}): {
  regularizarAte: Date;
  acao:
    | 'AGUARDAR_REGULARIZACAO'
    | 'MANTER_ACESSO_PAGAMENTO_CONFIRMADO'
    | 'ENCERRAR_RENOVACAO_E_CANCELAR_FATURA'
    | 'INICIAR_CONSULTA_EXPORTACAO';
  gerarDividaAssinatura: false;
  consultaExportacaoAte?: Date;
} {
  exigirDataValida(input.avisoEnviadoEm, 'Data do aviso');
  exigirDataValida(input.agora, 'Data atual');
  const regularizarAte = adicionarDias(input.avisoEnviadoEm, 7);

  if (input.fatura === 'PAGA') {
    return {
      regularizarAte,
      acao: 'MANTER_ACESSO_PAGAMENTO_CONFIRMADO',
      gerarDividaAssinatura: false,
    };
  }
  if (input.agora < regularizarAte) {
    return {
      regularizarAte,
      acao: 'AGUARDAR_REGULARIZACAO',
      gerarDividaAssinatura: false,
    };
  }

  return {
    regularizarAte,
    acao:
      input.fatura === 'PENDENTE'
        ? 'ENCERRAR_RENOVACAO_E_CANCELAR_FATURA'
        : 'INICIAR_CONSULTA_EXPORTACAO',
    gerarDividaAssinatura: false,
    consultaExportacaoAte: calcularFimConsultaExportacao(regularizarAte),
  };
}

export function reajustePodeVigorar(input: {
  avisoEm: Date;
  renovacaoEm: Date;
}): boolean {
  exigirDataValida(input.avisoEm, 'Data do aviso');
  exigirDataValida(input.renovacaoEm, 'Data da renovação');
  return input.renovacaoEm.getTime() - input.avisoEm.getTime() >= 30 * DIA_MS;
}

export function podeEscreverNaAssinatura(input: {
  status: string;
  agora: Date;
  fimAcessoEm?: Date | null;
  testeFim?: Date | null;
  cicloFim?: Date | null;
  toleranciaAte?: Date | null;
  avisoPagamentoEm?: Date | null;
}): boolean {
  if (['PRE_CADASTRO', 'CONSULTA_EXPORTACAO', 'ENCERRADA'].includes(input.status)) {
    return false;
  }
  if (input.fimAcessoEm && input.agora >= input.fimAcessoEm) return false;
  if (input.status === 'PAGAMENTO_PENDENTE' && !input.avisoPagamentoEm && !input.toleranciaAte) return true;
  const limite = input.status === 'TESTE' ? input.testeFim
    : input.status === 'PAGAMENTO_PENDENTE' ? input.toleranciaAte : input.cicloFim;
  return Boolean(limite && input.agora < limite);
}

export function podeLerNaAssinatura(input: {
  status: string; agora: Date; fimAcessoEm?: Date | null; testeFim?: Date | null;
  cicloFim?: Date | null; toleranciaAte?: Date | null; avisoPagamentoEm?: Date | null; consultaExportacaoAte?: Date | null;
}): boolean {
  if (input.status === 'ENCERRADA' || input.status === 'PRE_CADASTRO') return false;
  if (podeEscreverNaAssinatura(input)) return true;
  const limite = input.fimAcessoEm || (input.status === 'PAGAMENTO_PENDENTE' ? input.toleranciaAte
    : input.status === 'TESTE' ? input.testeFim : input.cicloFim);
  const consultaAte = input.consultaExportacaoAte || (limite ? calcularFimConsultaExportacao(limite) : null);
  return Boolean(consultaAte && input.agora < consultaAte);
}
