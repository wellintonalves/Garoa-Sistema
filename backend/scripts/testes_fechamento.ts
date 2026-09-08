import assert from 'assert';
import { calcularFechamento } from '../src/utils/financeiro.util';
import { obterIdsServicosAgendamento } from '../src/utils/agendamento.util';

console.log('Iniciando Testes de Fechamento...\n');

const configFidelidadePadrao = {
  resgatePontosAtivo: true,
  valorPorPonto: 0.10,
  percentualMaxPontos: 30,
  descontoMaxReais: 50,
  descontoMaxPercentual: 15,
  permitirCombinarDescontos: false,
  pontosPorReal: 1,
  pontosPorVisita: 10,
};

const configGlobalPadrao: { baseCalculoComissao: 'VALOR_BRUTO' | 'VALOR_LIQUIDO', baseCalculoPontos: 'VALOR_BRUTO' | 'VALOR_LIQUIDO' } = {
  baseCalculoComissao: 'VALOR_LIQUIDO',
  baseCalculoPontos: 'VALOR_LIQUIDO',
};

function runTest(nome: string, fn: () => void) {
  try {
    fn();
    console.log(`[PASS] ${nome}`);
  } catch (error: any) {
    console.error(`[FAIL] ${nome}`);
    console.error(`   ${error.message}`);
    process.exit(1);
  }
}

// 5.1 3 serviços (40 + 25 + 10), desconto 10%, comissão 50%
runTest('5.1: 3 serviços, desconto 10%, comissão 50%', () => {
  const result = calcularFechamento({
    valorBrutoOriginal: 75,
    precosServicosAtuais: [40, 25, 10],
    tipoDesconto: 'PERCENTUAL',
    valorDescontoReais: 0,
    valorDescontoPercentual: 10,
    pontosUsados: 0,
    saldoPontos: 0,
    configFidelidade: configFidelidadePadrao,
    configGlobal: configGlobalPadrao,
    percentualComissao: 50
  });

  assert.strictEqual(result.valorBruto, 75);
  assert.strictEqual(result.valorDesconto, 7.50);
  assert.strictEqual(result.valorLiquido, 67.50);
  assert.strictEqual(result.valorComissao, 33.75); // 50% de 67.50
});

// 5.2 3 serviços sem desconto
runTest('5.2: 3 serviços sem desconto', () => {
  const result = calcularFechamento({
    valorBrutoOriginal: 75,
    precosServicosAtuais: [40, 25, 10],
    tipoDesconto: 'NENHUM',
    valorDescontoReais: 0,
    valorDescontoPercentual: 0,
    pontosUsados: 0,
    saldoPontos: 0,
    configFidelidade: configFidelidadePadrao,
    configGlobal: configGlobalPadrao,
    percentualComissao: 50
  });

  assert.strictEqual(result.valorBruto, 75);
  assert.strictEqual(result.valorComissao, 37.50); // 50% de 75
});

// 5.3 1 serviço de 40,00, desconto 10%
runTest('5.3: 1 serviço de 40, desconto 10%', () => {
  const result = calcularFechamento({
    valorBrutoOriginal: 40,
    precosServicosAtuais: [40],
    tipoDesconto: 'PERCENTUAL',
    valorDescontoReais: 0,
    valorDescontoPercentual: 10,
    pontosUsados: 0,
    saldoPontos: 0,
    configFidelidade: configFidelidadePadrao,
    configGlobal: configGlobalPadrao,
    percentualComissao: 50
  });

  assert.strictEqual(result.valorLiquido, 36.00);
});

// 5.4 valorCobrado: 1,00 enviado no corpo da requisição
runTest('5.4: valorCobrado ignorado na função (a função usa o precosServicosAtuais / bruto original)', () => {
  // Simular recálculo quando bruto é zero
  const result = calcularFechamento({
    valorBrutoOriginal: 0, // zerado
    precosServicosAtuais: [40, 25, 10],
    tipoDesconto: 'NENHUM',
    valorDescontoReais: 0,
    valorDescontoPercentual: 0,
    pontosUsados: 0,
    saldoPontos: 0,
    configFidelidade: configFidelidadePadrao,
    configGlobal: configGlobalPadrao,
    percentualComissao: 50
  });
  
  assert.strictEqual(result.valorBruto, 75);
  assert.strictEqual(result.valorLiquido, 75);
});

// 5.5 Teto de 30% em pontos, 3 serviços
runTest('5.5: Teto de 30% em pontos', () => {
  let estourou = false;
  try {
    calcularFechamento({
      valorBrutoOriginal: 75,
      precosServicosAtuais: [40, 25, 10],
      tipoDesconto: 'PONTOS',
      valorDescontoReais: 0,
      valorDescontoPercentual: 0,
      pontosUsados: 1000,
      saldoPontos: 1000,
      configFidelidade: configFidelidadePadrao,
      configGlobal: configGlobalPadrao,
      percentualComissao: 50
    });
  } catch (err: any) {
    if (err.message.includes('Você só pode usar até 225 pontos')) {
      estourou = true;
    }
  }
  assert.strictEqual(estourou, true, 'Deveria ter barrado em 225 pontos');
});

// 5.6 Acúmulo de pontos, 3 serviços com desconto
runTest('5.6: Acúmulo de pontos', () => {
  const result = calcularFechamento({
    valorBrutoOriginal: 75,
    precosServicosAtuais: [40, 25, 10],
    tipoDesconto: 'PERCENTUAL',
    valorDescontoReais: 0,
    valorDescontoPercentual: 10,
    pontosUsados: 0,
    saldoPontos: 0,
    configFidelidade: configFidelidadePadrao,
    configGlobal: { ...configGlobalPadrao, baseCalculoPontos: 'VALOR_LIQUIDO' },
    percentualComissao: 50
  });

  // Mesma precedência do crédito real: por valor substitui pontos por visita.
  assert.strictEqual(result.pontosAcumulados, 67);
});

// 5.7 Preço alterado depois da marcação -> fechamento usa o preço da marcação
runTest('5.7: Preço alterado depois da marcação', () => {
  const result = calcularFechamento({
    valorBrutoOriginal: 75, // Preço da marcação
    precosServicosAtuais: [50, 30, 15], // Preços subiram para 95
    tipoDesconto: 'NENHUM',
    valorDescontoReais: 0,
    valorDescontoPercentual: 0,
    pontosUsados: 0,
    saldoPontos: 0,
    configFidelidade: configFidelidadePadrao,
    configGlobal: configGlobalPadrao,
    percentualComissao: 50
  });

  assert.strictEqual(result.valorBruto, 75); // Respeita marcação
});

// 5.8 servicosIds vazio e só servicoId preenchido
runTest('5.8: servicosIds vazio, servicoId preenchido -> valor correto, nao zero', () => {
  const agendamento = {
    id: '123',
    servicoId: 'serv1',
    servicosIds: []
  };

  const ids = obterIdsServicosAgendamento(agendamento);
  assert.deepStrictEqual(ids, ['serv1']);
});

// 5.9 Sem barbeiro e barbeiro com 0% não podem receber a comissão padrão.
runTest('5.9: comissão 0% permanece zero', () => {
  const result = calcularFechamento({
    valorBrutoOriginal: 105,
    precosServicosAtuais: [105],
    tipoDesconto: 'NENHUM',
    valorDescontoReais: 0,
    valorDescontoPercentual: 0,
    pontosUsados: 0,
    saldoPontos: 0,
    configFidelidade: configFidelidadePadrao,
    configGlobal: configGlobalPadrao,
    percentualComissao: 0,
  });

  assert.strictEqual(result.valorComissao, 0);
  assert.strictEqual(result.valorLiquido, 105);
});

runTest('5.10: comissão positiva continua calculada', () => {
  const result = calcularFechamento({
    valorBrutoOriginal: 105,
    precosServicosAtuais: [105],
    tipoDesconto: 'NENHUM',
    valorDescontoReais: 0,
    valorDescontoPercentual: 0,
    pontosUsados: 0,
    saldoPontos: 0,
    configFidelidade: configFidelidadePadrao,
    configGlobal: configGlobalPadrao,
    percentualComissao: 40,
  });

  assert.strictEqual(result.valorComissao, 42);
  assert.strictEqual(result.valorLiquido, 105);
});

console.log('\nTodos os testes passaram! ✅\n');
