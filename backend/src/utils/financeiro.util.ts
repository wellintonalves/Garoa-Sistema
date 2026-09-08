import { TipoDesconto } from '../services/desconto.service';
import { calcularPontosAtendimento, ConfiguracaoAcumulo } from './fidelidade.util';

export interface ConfiguracaoFidelidadeFinanceiro extends ConfiguracaoAcumulo {
  resgatePontosAtivo: boolean;
  valorPorPonto: number;
  percentualMaxPontos: number;
  descontoMaxReais: number;
  descontoMaxPercentual: number;
  permitirCombinarDescontos: boolean;
  pontosPorReal: number;
  pontosPorVisita: number;
}

export interface EntradaFechamento {
  servicosIds?: string[];
  temCliente?: boolean;
  dataNascimento?: Date | null;
  valorBrutoOriginal: number;
  precosServicosAtuais: number[];
  tipoDesconto: TipoDesconto;
  valorDescontoReais: number;
  valorDescontoPercentual: number;
  pontosUsados: number;
  saldoPontos: number;
  configFidelidade: ConfiguracaoFidelidadeFinanceiro;
  configGlobal: {
    baseCalculoComissao: 'VALOR_BRUTO' | 'VALOR_LIQUIDO';
    baseCalculoPontos: 'VALOR_BRUTO' | 'VALOR_LIQUIDO';
  };
  percentualComissao: number;
}

export interface ResultadoFechamento {
  valorBruto: number;
  descontoManual: number;
  descontoPontos: number;
  pontosUtilizados: number;
  valorDesconto: number;
  valorLiquido: number;
  valorComissao: number;
  pontosAcumulados: number;
  maxPontosUtilizaveis: number;
}

export function calcularFechamento(entrada: EntradaFechamento): ResultadoFechamento {
  const { configFidelidade, configGlobal } = entrada;

  let valorBruto = entrada.valorBrutoOriginal;
  if (!valorBruto || valorBruto <= 0) {
    valorBruto = entrada.precosServicosAtuais.reduce((acc, preco) => acc + Number(preco), 0);
  }
  
  if (valorBruto < 0) {
    throw new Error('Valor bruto não pode ser negativo');
  }

  let descontoManual = 0;
  if (![entrada.valorDescontoReais, entrada.valorDescontoPercentual, entrada.pontosUsados].every(Number.isFinite)
    || entrada.valorDescontoReais < 0 || entrada.valorDescontoPercentual < 0
    || entrada.pontosUsados < 0 || !Number.isInteger(entrada.pontosUsados)) {
    throw new Error('Informe descontos válidos e pontos inteiros não negativos.');
  }
  const temDescontoManual = entrada.valorDescontoReais > 0 || entrada.valorDescontoPercentual > 0;
  const querUsarPontos = (entrada.tipoDesconto === 'PONTOS' || entrada.tipoDesconto === 'COMBINADO') && entrada.pontosUsados > 0;

  if (temDescontoManual && entrada.pontosUsados > 0 && !configFidelidade.permitirCombinarDescontos) {
    throw new Error('Combinação de desconto manual com pontos não é permitida.');
  }

  if (querUsarPontos && !configFidelidade.resgatePontosAtivo) {
    throw new Error('O resgate de pontos está desativado.');
  }

  // Desconto Manual
  if (entrada.tipoDesconto === 'PERCENTUAL' || (entrada.tipoDesconto === 'COMBINADO' && entrada.valorDescontoPercentual > 0)) {
    if (entrada.valorDescontoPercentual > configFidelidade.descontoMaxPercentual) {
      throw new Error(`O desconto percentual (${entrada.valorDescontoPercentual}%) excede o máximo permitido (${configFidelidade.descontoMaxPercentual}%).`);
    }
    if (entrada.valorDescontoPercentual < 0) throw new Error('Desconto percentual não pode ser negativo.');
    
    descontoManual = Math.round((valorBruto * entrada.valorDescontoPercentual) / 100 * 100) / 100;
  } else if (entrada.tipoDesconto === 'REAIS' || (entrada.tipoDesconto === 'COMBINADO' && entrada.valorDescontoReais > 0)) {
    if (configFidelidade.descontoMaxReais > 0 && entrada.valorDescontoReais > configFidelidade.descontoMaxReais) {
      throw new Error(`O desconto em reais (R$ ${entrada.valorDescontoReais}) excede o máximo permitido (R$ ${configFidelidade.descontoMaxReais}).`);
    }
    if (entrada.valorDescontoReais > valorBruto) throw new Error('O desconto não pode ser maior que o valor bruto.');
    if (entrada.valorDescontoReais < 0) throw new Error('Desconto em reais não pode ser negativo.');
    
    descontoManual = entrada.valorDescontoReais;
  }

  // Pontos
  let baseParaPontos = valorBruto;
  if (configFidelidade.permitirCombinarDescontos) {
    baseParaPontos = Math.max(0, valorBruto - descontoManual);
  } else if (entrada.tipoDesconto === 'PONTOS') {
    baseParaPontos = valorBruto;
  }

  const tetoPontosReais = Math.floor((baseParaPontos * configFidelidade.percentualMaxPontos) / 100 * 100) / 100;
  
  let maxPontosUtilizaveis = 0;
  if (configFidelidade.valorPorPonto > 0) {
    const pontosNecessarios = Math.floor(tetoPontosReais / configFidelidade.valorPorPonto);
    maxPontosUtilizaveis = Math.min(pontosNecessarios, Math.floor(entrada.saldoPontos));
  }

  let descontoPontos = 0;
  let pontosUtilizados = 0;

  if (querUsarPontos) {
    if (entrada.pontosUsados > maxPontosUtilizaveis) {
      throw new Error(`Você só pode usar até ${maxPontosUtilizaveis} pontos para este serviço.`);
    }
    pontosUtilizados = entrada.pontosUsados;
    descontoPontos = pontosUtilizados * configFidelidade.valorPorPonto;
  }

  const valorDesconto = Math.round((descontoManual + descontoPontos) * 100) / 100;
  const valorLiquido = Math.max(0, Math.round((valorBruto - valorDesconto) * 100) / 100);

  // Comissão
  const baseComissao = entrada.configGlobal.baseCalculoComissao === 'VALOR_BRUTO' ? valorBruto : valorLiquido;
  const valorComissao = Math.round((baseComissao * entrada.percentualComissao) / 100 * 100) / 100;

  // Acúmulo de Pontos da Visita
  const baseAcumulo = entrada.configGlobal.baseCalculoPontos === 'VALOR_BRUTO' ? valorBruto : valorLiquido;
  const pontosAcumulados = entrada.temCliente === false ? 0 : calcularPontosAtendimento(
    configFidelidade, entrada.servicosIds ?? [], baseAcumulo, entrada.dataNascimento,
  );

  return {
    valorBruto,
    descontoManual,
    descontoPontos,
    pontosUtilizados,
    valorDesconto,
    valorLiquido,
    valorComissao,
    pontosAcumulados,
    maxPontosUtilizaveis,
  };
}
