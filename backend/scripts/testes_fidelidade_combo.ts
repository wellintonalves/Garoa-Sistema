import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import { somarPontosPorServicos, calcularPontosAtendimento } from '../src/utils/fidelidade.util';

// Adaptador em memória: executa o motor real sem conectar a nenhum banco.
const regras = [{ servicoId: 'corte', pontos: 10 }, { servicoId: 'barba', pontos: 6 }];
let unidade = 'A';
let ativo = true;
let existente = false;
let regrasAtuais: unknown = regras;
const fake = {
  $extends() { return this; },
  pontoFidelidade: { async findFirst() { return existente ? { id: 'credito-existente' } : null; } },
  configuracaoFidelidade: { async findUnique({ where }: { where: { barbeariaId: string } }) {
    assert.equal(where.barbeariaId, unidade);
    return { ativo, regrasPorServico: regrasAtuais, pontosPorReal: 1, pontosPorVisita: 5,
      pontosPorIndicacao: 0, pontosDobroAniversario: false };
  } },
  cliente: { async findUnique() { return { dataNascimento: null }; } },
  servico: { async findMany({ where }: { where: { barbeariaId: string } }) {
    assert.equal(where.barbeariaId, unidade);
    return [{ id: 'corte', nome: 'Corte' }, { id: 'barba', nome: 'Barba' }];
  } },
};

async function main() {
  (globalThis as unknown as { prisma: PrismaClient }).prisma = fake as unknown as PrismaClient;
  const { prepararOperacoesFidelidade, prepararOperacoesFidelidadeLancamento } = await import('../src/services/fidelidade.engine');
  assert.equal(somarPontosPorServicos(['corte', 'barba'], regras), 16);
  assert.equal(somarPontosPorServicos(['corte', 'corte'], regras), 20);
  assert.equal(somarPontosPorServicos(['ausente'], regras), 0);
  assert.equal(somarPontosPorServicos(['corte'], null), 0);
  const configAniversario = { ativo: true, regrasPorServico: regras, pontosPorReal: 1, pontosPorVisita: 5, pontosDobroAniversario: true };
  assert.equal(calcularPontosAtendimento(configAniversario, ['corte', 'barba'], 65,
    new Date('1990-09-07T00:00:00Z'), new Date('2026-09-08T01:00:00Z')), 32);
  assert.equal(calcularPontosAtendimento(configAniversario, ['corte', 'barba'], 65,
    new Date('1990-09-08T00:00:00Z'), new Date('2026-09-08T01:00:00Z')), 16);
  for (const barbearia of ['A', 'B']) {
    unidade = barbearia;
    regrasAtuais = barbearia === 'A' ? regras : [{ servicoId: 'corte', pontos: 3 }, { servicoId: 'barba', pontos: 2 }];
    const esperado = barbearia === 'A' ? 16 : 5;
    for (const preparar of [
      () => prepararOperacoesFidelidade('agenda', 'cliente', unidade, ['corte', 'barba'], 67.5),
      () => prepararOperacoesFidelidadeLancamento('avulso', 'cliente', unidade, ['corte', 'barba'], 67.5),
    ]) {
      const ops = await preparar();
      assert.equal(ops.pontosParaCriar.length, 1);
      assert.equal(ops.pontosParaCriar[0].pontos, esperado);
      assert.equal(ops.pontosParaCriar[0].barbeariaId, unidade);
      assert.match(ops.pontosParaCriar[0].descricao, /Corte \+ Barba/);
      existente = true;
      assert.equal((await preparar()).pontosParaCriar.length, 0);
      existente = false;
      ativo = false;
      assert.equal((await preparar()).pontosParaCriar.length, 0);
      ativo = true;
    }
  }
  regrasAtuais = [];
  const fallback = await prepararOperacoesFidelidadeLancamento('avulso', 'cliente', unidade, ['corte', 'barba'], 67.5);
  assert.equal(fallback.pontosParaCriar[0].pontos, 67);
  console.log('PASS: soma por serviço, combos, regras de duas unidades, descrição, crédito existente, programa inativo e fallback por valor. Motor real com persistência simulada; sem banco.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
