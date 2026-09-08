import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { tenantStorage } from '../src/lib/als';
import { FinanceiroService } from '../src/services/financeiro.service';
import { prisma } from '../src/lib/prisma';

for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
  const url = new URL(process.env[key] ?? '');
  assert.equal(url.hostname, 'altaria.proxy.rlwy.net');
  assert.equal(url.port, '49931');
}
const db = new PrismaClient();
const id = randomUUID();
async function main() {
  try {
    const { cliente, servico } = await db.$transaction(async tx => {
      await tx.barbearia.create({ data: { id, nome: 'Teste temporário de concorrência', slug: `codex-concorrencia-${id}` } });
      const usuario = await tx.usuario.create({ data: { barbeariaId: id, nome: 'Cliente sintético', email: `${id}@example.invalid`, senha: 'sem-login', papel: 'CLIENTE' } });
      const cliente = await tx.cliente.create({ data: { barbeariaId: id, usuarioId: usuario.id } });
      const servico = await tx.servico.create({ data: { barbeariaId: id, nome: 'Teste', preco: 200, duracaoMinutos: 30 } });
      await tx.configuracao.create({ data: { barbeariaId: id } });
      await tx.configuracaoFidelidade.create({ data: { barbeariaId: id, ativo: true, resgatePontosAtivo: true,
        valorPorPonto: 0.1, percentualMaxPontos: 30, regrasPorServico: [{ servicoId: servico.id, pontos: 1 }] } });
      await tx.pontoFidelidade.create({ data: { clienteId: cliente.id, barbeariaId: id, pontos: 700, descricao: 'Saldo sintético temporário' } });
      return { cliente, servico };
    });
    const criar = () => tenantStorage.run({ barbeariaId: id }, () => FinanceiroService.criar({
      tipo: 'ENTRADA', categoria: 'Serviço', valor: 1, formaPagamento: 'PIX', data: '2026-09-07',
      clienteId: cliente.id, servicoId: servico.id, tipoDesconto: 'PONTOS', pontosUsados: 500,
    }));
    const resultados = await Promise.allSettled([criar(), criar()]);
    assert.equal(resultados.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(await db.lancamentoFinanceiro.count({ where: { barbeariaId: id } }), 1);
    const movimentos = await db.pontoFidelidade.aggregate({ where: { barbeariaId: id }, _sum: { pontos: true } });
    assert.equal(movimentos._sum.pontos, 201);
    console.log('PASS concorrência PostgreSQL: dois lançamentos disputaram 700 pontos; só um debitou 500, creditou 1 e gerou lançamento. Saldo final 201.');
  } finally {
    // Somente a unidade sintética criada acima e seus dependentes, nunca dados existentes.
    await db.$transaction(async tx => {
      await tx.pontoFidelidade.deleteMany({ where: { barbeariaId: id } });
      await tx.itemAtendimento.deleteMany({ where: { barbeariaId: id } });
      await tx.lancamentoFinanceiro.deleteMany({ where: { barbeariaId: id } });
      await tx.barbearia.deleteMany({ where: { id, slug: `codex-concorrencia-${id}` } });
    });
    assert.equal(await db.barbearia.count({ where: { id } }), 0);
    console.log('PASS limpeza: fixtures temporárias removidas.');
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Falha'); process.exitCode = 1; })
  .finally(async () => { await db.$disconnect(); await prisma.$disconnect(); });
