import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { calcularDescontoProdutos } from '../src/services/descontoProdutos.service';
import { calcularFechamento, EntradaFechamento } from '../src/utils/financeiro.util';

async function main() {
  const config: EntradaFechamento['configFidelidade'] = {
    ativo: true, regrasPorServico: [], pontosDobroAniversario: false,
    resgatePontosAtivo: true, valorPorPonto: 0.1, percentualMaxPontos: 30,
    descontoMaxReais: 0, descontoMaxPercentual: 100,
    permitirCombinarDescontos: false, pontosPorReal: 0, pontosPorVisita: 0,
  };
  const global: EntradaFechamento['configGlobal'] = {
    baseCalculoComissao: 'VALOR_BRUTO', baseCalculoPontos: 'VALOR_BRUTO',
  };
  // Mock somente das leituras: nenhum banco ou registro de teste é criado.
  const tx = {
    cliente: { findFirst: async () => ({ id: 'qa-cliente', dataNascimento: null }) },
    configuracaoFidelidade: { findUnique: async () => config },
    configuracao: { findUnique: async () => global },
    pontoFidelidade: { aggregate: async () => ({ _sum: { pontos: 500 } }) },
    resgateRecompensa: { aggregate: async () => ({ _sum: { pontosUsados: 0 } }) },
  } as unknown as Prisma.TransactionClient;
  await assert.rejects(
    calcularDescontoProdutos(tx, 'qa-loja', new Prisma.Decimal(100), {
      clienteId: 'qa-cliente', tipoDesconto: 'PONTOS', pontosUsados: 301,
    }),
    { message: 'Você só pode usar até 300 pontos nesta venda.' },
  );
  assert.throws(() => calcularFechamento({
    valorBrutoOriginal: 100, precosServicosAtuais: [100], tipoDesconto: 'PONTOS',
    valorDescontoReais: 0, valorDescontoPercentual: 0, pontosUsados: 301,
    saldoPontos: 500, percentualComissao: 0, configFidelidade: config, configGlobal: global,
  }), { message: 'Você só pode usar até 300 pontos para este serviço.' });
  config.resgatePontosAtivo = false;
  await assert.rejects(
    calcularDescontoProdutos(tx, 'qa-loja', new Prisma.Decimal(100), {
      clienteId: 'qa-cliente', tipoDesconto: 'PONTOS', pontosUsados: 100,
    }),
    { message: 'O resgate de pontos está desativado.' },
  );
  console.log('PASS: mensagem de produtos corrigida; serviços e demais erros preservados.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
