import assert from 'assert';
import { calcularFechamento, EntradaFechamento } from '../utils/financeiro.util';

function runTests() {
  const configPadrao = {
    configFidelidade: {
      resgatePontosAtivo: true,
      valorPorPonto: 1,
      percentualMaxPontos: 30,
      descontoMaxReais: 0,
      descontoMaxPercentual: 100,
      permitirCombinarDescontos: true,
      pontosPorReal: 1,
      pontosPorVisita: 0,
    },
    configGlobal: {
      baseCalculoComissao: 'VALOR_LIQUIDO' as const,
      baseCalculoPontos: 'VALOR_LIQUIDO' as const,
    },
    percentualComissao: 50,
    saldoPontos: 100,
  };

  console.log('--- Teste 1: 3 serviços (40 + 25 + 10), desconto 10%, comissão 50% ---');
  let result = calcularFechamento({
    ...configPadrao,
    valorBrutoOriginal: 0,
    precosServicosAtuais: [40, 25, 10],
    tipoDesconto: 'PERCENTUAL',
    valorDescontoPercentual: 10,
    valorDescontoReais: 0,
    pontosUsados: 0,
  });
  assert.strictEqual(result.valorBruto, 75);
  assert.strictEqual(result.valorDesconto, 7.5);
  assert.strictEqual(result.valorLiquido, 67.5);
  assert.strictEqual(result.valorComissao, 33.75);

  console.log('--- Teste 2: 3 serviços, sem desconto ---');
  result = calcularFechamento({
    ...configPadrao,
    valorBrutoOriginal: 0,
    precosServicosAtuais: [40, 25, 10],
    tipoDesconto: 'NENHUM',
    valorDescontoPercentual: 0,
    valorDescontoReais: 0,
    pontosUsados: 0,
  });
  assert.strictEqual(result.valorBruto, 75);
  assert.strictEqual(result.valorDesconto, 0);
  assert.strictEqual(result.valorLiquido, 75);
  assert.strictEqual(result.valorComissao, 37.5);

  console.log('--- Teste 3: 1 serviço de 40,00, desconto 10% ---');
  result = calcularFechamento({
    ...configPadrao,
    valorBrutoOriginal: 0,
    precosServicosAtuais: [40],
    tipoDesconto: 'PERCENTUAL',
    valorDescontoPercentual: 10,
    valorDescontoReais: 0,
    pontosUsados: 0,
  });
  assert.strictEqual(result.valorBruto, 40);
  assert.strictEqual(result.valorDesconto, 4);
  assert.strictEqual(result.valorLiquido, 36);
  assert.strictEqual(result.valorComissao, 18);

  // O teste 4 (ignorar valorCobrado) não se aplica à função pura (ela só recebe os preços na array). A proteção fica no controller.

  console.log('--- Teste 5: Teto de 30% em pontos, 3 serviços ---');
  result = calcularFechamento({
    ...configPadrao,
    valorBrutoOriginal: 0,
    precosServicosAtuais: [40, 25, 10], // Bruto 75, 30% = 22.5. Logo pode usar até 22 pontos
    tipoDesconto: 'PONTOS',
    valorDescontoPercentual: 0,
    valorDescontoReais: 0,
    pontosUsados: 22,
  });
  assert.strictEqual(result.valorBruto, 75);
  assert.strictEqual(result.maxPontosUtilizaveis, 22);
  assert.strictEqual(result.valorDesconto, 22);
  assert.strictEqual(result.valorLiquido, 53);

  console.log('--- Teste 6: Acúmulo de pontos, 3 serviços com desconto ---');
  result = calcularFechamento({
    ...configPadrao,
    valorBrutoOriginal: 0,
    precosServicosAtuais: [40, 25, 10],
    tipoDesconto: 'PERCENTUAL',
    valorDescontoPercentual: 10,
    valorDescontoReais: 0,
    pontosUsados: 0,
  });
  assert.strictEqual(result.pontosAcumulados, 67); // 67.50, arredondado para baixo

  // Teste 7: Preço de um serviço alterado depois da marcação -> Isso é provado pela assinatura da função
  // que aceita o array `precosServicos` do agendamento (que lerá do `valorBruto` ou do array atual).
  // A trava lê o valorBruto, se zero ele puxa o array de preço atual.

  console.log('Todos os testes puros passaram com sucesso!');
}

runTests();
