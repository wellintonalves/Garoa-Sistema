import { DescontoService, EntradaDesconto, ConfiguracaoFidelidadeDesconto } from './desconto.service';
import * as assert from 'assert';

const baseConfig: ConfiguracaoFidelidadeDesconto = {
  resgatePontosAtivo: true,
  valorPorPonto: 0.10,
  percentualMaxPontos: 30,
  descontoMaxReais: 0,
  descontoMaxPercentual: 100,
  permitirCombinarDescontos: false
};

function runTests() {
  console.log("Iniciando bateria de testes...");

  // 1. Sem desconto -> líquido = bruto
  let res = DescontoService.calcularDesconto({
    valorBruto: 50,
    tipo: 'NENHUM',
    saldoPontos: 100,
    config: baseConfig
  });
  assert.strictEqual(res.valorLiquido, 50);

  // 2. Desconto em R$ dentro e acima do limite
  res = DescontoService.calcularDesconto({
    valorBruto: 50,
    tipo: 'REAIS',
    valorReais: 10,
    saldoPontos: 100,
    config: { ...baseConfig, descontoMaxReais: 15 }
  });
  assert.strictEqual(res.valorLiquido, 40);

  assert.throws(() => {
    DescontoService.calcularDesconto({
      valorBruto: 50,
      tipo: 'REAIS',
      valorReais: 20,
      saldoPontos: 100,
      config: { ...baseConfig, descontoMaxReais: 15 }
    });
  }, /excede o máximo permitido/);

  // 3. Desconto em % dentro e acima do limite
  res = DescontoService.calcularDesconto({
    valorBruto: 100,
    tipo: 'PERCENTUAL',
    percentual: 10,
    saldoPontos: 100,
    config: { ...baseConfig, descontoMaxPercentual: 15 }
  });
  assert.strictEqual(res.valorLiquido, 90);

  assert.throws(() => {
    DescontoService.calcularDesconto({
      valorBruto: 100,
      tipo: 'PERCENTUAL',
      percentual: 20,
      saldoPontos: 100,
      config: { ...baseConfig, descontoMaxPercentual: 15 }
    });
  }, /excede o máximo permitido/);

  // 4. Pontos com saldo suficiente, sem estourar o teto percentual
  // Bruto: 100, max pontos: 30% = 30 reais = 300 pontos
  res = DescontoService.calcularDesconto({
    valorBruto: 100,
    tipo: 'PONTOS',
    pontos: 100,
    saldoPontos: 500,
    config: baseConfig
  });
  assert.strictEqual(res.valorLiquido, 90);

  // 5. Pontos com saldo maior que o teto percentual -> limitado pelo teto
  res = DescontoService.calcularDesconto({
    valorBruto: 100,
    tipo: 'PONTOS',
    pontos: 0,
    saldoPontos: 500,
    config: baseConfig
  });
  assert.strictEqual(res.maxPontosUtilizaveis, 300);

  // 6. Pontos com saldo menor que o teto -> limitado pelo saldo
  res = DescontoService.calcularDesconto({
    valorBruto: 100,
    tipo: 'PONTOS',
    pontos: 0,
    saldoPontos: 150,
    config: baseConfig
  });
  assert.strictEqual(res.maxPontosUtilizaveis, 150);

  // 7. resgatePontosAtivo = false + pontos > 0 -> erro
  assert.throws(() => {
    DescontoService.calcularDesconto({
      valorBruto: 100,
      tipo: 'PONTOS',
      pontos: 50,
      saldoPontos: 100,
      config: { ...baseConfig, resgatePontosAtivo: false }
    });
  }, /está desativado/);

  // 8. permitirCombinarDescontos = false + manual e pontos juntos -> erro
  assert.throws(() => {
    DescontoService.calcularDesconto({
      valorBruto: 100,
      tipo: 'COMBINADO',
      valorReais: 10,
      pontos: 50,
      saldoPontos: 100,
      config: { ...baseConfig, permitirCombinarDescontos: false }
    });
  }, /não é permitida/);

  // 9. permitirCombinarDescontos = true -> pontos calculados sobre o valor já descontado
  // Bruto: 100. Desconto 10. Base = 90. Max pontos = 30% de 90 = 27 reais = 270 pontos.
  res = DescontoService.calcularDesconto({
    valorBruto: 100,
    tipo: 'COMBINADO',
    valorReais: 10,
    pontos: 270,
    saldoPontos: 500,
    config: { ...baseConfig, permitirCombinarDescontos: true }
  });
  assert.strictEqual(res.valorLiquido, 63); // 100 - 10 - 27

  assert.throws(() => {
    DescontoService.calcularDesconto({
      valorBruto: 100,
      tipo: 'COMBINADO',
      valorReais: 10,
      pontos: 271, // excede max 270
      saldoPontos: 500,
      config: { ...baseConfig, permitirCombinarDescontos: true }
    });
  }, /excede o máximo utilizável/);

  // 10. Desconto que zeraria/negativaria o total -> erro
  assert.throws(() => {
    DescontoService.calcularDesconto({
      valorBruto: 50,
      tipo: 'REAIS',
      valorReais: 60,
      saldoPontos: 100,
      config: baseConfig
    });
  }, /não pode ser maior que o valor bruto/);

  // 11. Arredondamento: serviço R$ 33.33 com 15% de desconto
  // 33.33 * 0.15 = 4.9995 -> round -> 5.00
  res = DescontoService.calcularDesconto({
    valorBruto: 33.33,
    tipo: 'PERCENTUAL',
    percentual: 15,
    saldoPontos: 100,
    config: baseConfig
  });
  assert.strictEqual(res.descontoManual, 5.00);
  assert.strictEqual(res.valorLiquido, 28.33);

  // Teste extra teto de pontos arredondamento: 
  // Base 33.33, teto 30% = 9.999 -> floor -> 9.99 reais -> 99 pontos (se 1 pt = 0.10)
  res = DescontoService.calcularDesconto({
    valorBruto: 33.33,
    tipo: 'PONTOS',
    pontos: 0,
    saldoPontos: 500,
    config: baseConfig
  });
  assert.strictEqual(res.maxPontosUtilizaveis, 99);

  console.log("Todos os testes passaram com sucesso!");
}

runTests();
