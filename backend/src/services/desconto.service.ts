export type TipoDesconto = 'NENHUM' | 'REAIS' | 'PERCENTUAL' | 'PONTOS' | 'COMBINADO';

export interface ConfiguracaoFidelidadeDesconto {
  resgatePontosAtivo: boolean;
  valorPorPonto: number;
  percentualMaxPontos: number;
  descontoMaxReais: number;
  descontoMaxPercentual: number;
  permitirCombinarDescontos: boolean;
}

export type EntradaDesconto = {
  valorBruto: number;
  tipo: TipoDesconto;
  valorReais?: number;
  percentual?: number;
  pontos?: number;
  saldoPontos: number;
  config: ConfiguracaoFidelidadeDesconto;
};

export type ResultadoDesconto = {
  valorBruto: number;
  descontoManual: number;
  descontoPontos: number;
  pontosUtilizados: number;
  valorDesconto: number;
  valorLiquido: number;
  maxPontosUtilizaveis: number;
};

export class DescontoService {
  /**
   * Função pura para calcular o valor do desconto.
   * Não interage com o banco de dados.
   */
  static calcularDesconto(entrada: EntradaDesconto): ResultadoDesconto {
    const {
      valorBruto,
      tipo,
      valorReais = 0,
      percentual = 0,
      pontos = 0,
      saldoPontos,
      config
    } = entrada;

    let descontoManual = 0;

    // Regra 10: Combinar
    const temDescontoManual = (tipo === 'REAIS' || tipo === 'PERCENTUAL' || tipo === 'COMBINADO') && (valorReais > 0 || percentual > 0);
    const querUsarPontos = (tipo === 'PONTOS' || tipo === 'COMBINADO') && pontos > 0;

    if (temDescontoManual && querUsarPontos && !config.permitirCombinarDescontos) {
      throw new Error('Combinação de desconto manual com pontos não é permitida.');
    }

    // Regra 9: Resgate Ativo
    if (querUsarPontos && !config.resgatePontosAtivo) {
      throw new Error('O resgate de pontos está desativado.');
    }

    // Cálculo Desconto Manual
    if (tipo === 'PERCENTUAL' || (tipo === 'COMBINADO' && percentual > 0)) {
      if (percentual > config.descontoMaxPercentual) {
        throw new Error(`O desconto percentual (${percentual}%) excede o máximo permitido (${config.descontoMaxPercentual}%).`);
      }
      if (percentual < 0) {
        throw new Error('Desconto percentual não pode ser negativo.');
      }
      // Math.round para desconto percentual
      descontoManual = Math.round((valorBruto * percentual) / 100 * 100) / 100; // Arredonda para 2 casas decimais
    } else if (tipo === 'REAIS' || (tipo === 'COMBINADO' && valorReais > 0)) {
      if (config.descontoMaxReais > 0 && valorReais > config.descontoMaxReais) {
        throw new Error(`O desconto em reais (R$ ${valorReais}) excede o máximo permitido (R$ ${config.descontoMaxReais}).`);
      }
      if (valorReais > valorBruto) {
        throw new Error('O desconto não pode ser maior que o valor bruto.');
      }
      if (valorReais < 0) {
        throw new Error('Desconto em reais não pode ser negativo.');
      }
      descontoManual = valorReais;
    }

    // Cálculo Pontos
    // Base para pontos = valorBruto - descontoManual (se combinação permitida) ou valorBruto (se tipo === 'PONTOS' puro).
    let base = valorBruto;
    if (config.permitirCombinarDescontos) {
      base = Math.max(0, valorBruto - descontoManual);
    } else if (tipo === 'PONTOS') {
      base = valorBruto;
    }

    // Teto em reais dos pontos
    const tetoPontosReais = Math.floor((base * config.percentualMaxPontos) / 100 * 100) / 100;
    
    // maxPontosUtilizaveis
    let maxPontosUtilizaveis = 0;
    if (config.valorPorPonto > 0) {
      maxPontosUtilizaveis = Math.min(saldoPontos, Math.floor(tetoPontosReais / config.valorPorPonto));
    }

    if (querUsarPontos) {
      if (!Number.isInteger(pontos) || pontos < 0) {
        throw new Error('A quantidade de pontos deve ser um número inteiro e positivo.');
      }
      if (pontos > maxPontosUtilizaveis) {
        throw new Error(`A quantidade de pontos informada (${pontos}) excede o máximo utilizável neste atendimento (${maxPontosUtilizaveis}).`);
      }
    }

    const descontoPontos = querUsarPontos ? Number((pontos * config.valorPorPonto).toFixed(2)) : 0;
    
    // Total
    const valorLiquido = Number((valorBruto - descontoManual - descontoPontos).toFixed(2));
    
    if (valorLiquido < 0) {
      throw new Error('O valor líquido não pode ser negativo.');
    }

    return {
      valorBruto: Number(valorBruto.toFixed(2)),
      descontoManual: Number(descontoManual.toFixed(2)),
      descontoPontos: Number(descontoPontos.toFixed(2)),
      pontosUtilizados: querUsarPontos ? pontos : 0,
      valorDesconto: Number((descontoManual + descontoPontos).toFixed(2)),
      valorLiquido: valorLiquido,
      maxPontosUtilizaveis
    };
  }
}
