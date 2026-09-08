import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { tenantStorage } from '../src/lib/als';

// Somente desenvolvimento conhecido. Todas as fixtures são revertidas numa única transação.
for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
  const url = new URL(process.env[key] ?? '');
  assert.equal(url.hostname, 'altaria.proxy.rlwy.net', 'Banco não reconhecido; teste cancelado.');
  assert.equal(url.port, '49931', 'Porta não reconhecida; teste cancelado.');
}
const db = new PrismaClient();
const rollback = new Error('ROLLBACK_TESTE');
const prefixo = `codex-test-${randomUUID()}`;

async function main() {
  try {
    await db.$transaction(async tx => {
      // Aplica a extensão REAL do projeto a operações SQL da transação de teste.
      // Transações internas dos serviços usam a transação externa, revertida no fim.
      const base = {
        $extends(extension: any) {
          return new Proxy({}, { get(_target, model: string) {
            if (model === '$transaction') return async (fn: (client: unknown) => Promise<unknown>) => fn(client);
            if (model.startsWith('$')) throw new Error(`Operação inesperada: ${model}`);
            return new Proxy({}, { get(_delegate, operation: string) {
              return (args: unknown) => extension.query.$allModels.$allOperations({
                model: model[0].toUpperCase() + model.slice(1), operation, args,
                query: (scoped: unknown) => (tx as any)[model][operation](scoped),
              });
            } });
          } });
        },
      };
      (globalThis as any).prisma = base;
      const { prisma: client } = await import('../src/lib/prisma');
      const { FinanceiroService } = await import('../src/services/financeiro.service');
      const { AgendamentoService } = await import('../src/services/agendamento.service');
      const { BarbeiroAppService } = await import('../src/services/barbeiroApp.service');
      const { ClienteService } = await import('../src/services/cliente.service');
      const { AprovacaoService } = await import('../src/services/aprovacao.service');
      const a = await tx.barbearia.create({ data: { nome: prefixo, slug: `${prefixo}-a` } });
      const b = await tx.barbearia.create({ data: { nome: prefixo, slug: `${prefixo}-b` } });
      const usuario = await tx.usuario.create({ data: { nome: 'Cliente sintético', email: `${prefixo}@example.invalid`, senha: 'sem-login', papel: 'CLIENTE' } });
      const cliente = await tx.cliente.create({ data: { usuarioId: usuario.id, barbeariaId: a.id } });
      await tx.clienteBarbearia.create({ data: { clienteId: cliente.id, barbeariaId: b.id } });
      for (const [indice, shop] of [a, b].entries()) {
        await tx.configuracao.create({ data: { barbeariaId: shop.id, baseCalculoPontos: 'VALOR_BRUTO' } });
        const corte = await tx.servico.create({ data: { barbeariaId: shop.id, nome: 'Corte', preco: 40, duracaoMinutos: 30 } });
        const barba = await tx.servico.create({ data: { barbeariaId: shop.id, nome: 'Barba', preco: 25, duracaoMinutos: 20 } });
        await tx.configuracaoFidelidade.create({ data: { barbeariaId: shop.id, ativo: true,
          resgatePontosAtivo: true, valorPorPonto: 0.1, percentualMaxPontos: 30,
          regrasPorServico: [{ servicoId: corte.id, pontos: 10 + indice }, { servicoId: barba.id, pontos: 6 }],
          pontosPorReal: 1, pontosPorVisita: 5 } });
        const u = await tx.usuario.create({ data: { nome: 'Barbeiro sintético', email: `${prefixo}-${indice}@example.invalid`, senha: 'sem-login', papel: 'BARBEIRO', barbeariaId: shop.id } });
        const barbeiro = await tx.barbeiro.create({ data: { usuarioId: u.id, barbeariaId: shop.id, especialidades: [], comissaoPercent: 0 } });
        await tx.pontoFidelidade.create({ data: { clienteId: cliente.id, barbeariaId: shop.id, pontos: 1000 + indice * 1000, descricao: prefixo } });
        const recompensa = await tx.recompensa.create({ data: { barbeariaId: shop.id, nome: prefixo, tipo: 'DESCONTO_REAIS', pontosNecessarios: 100 } });
        await tx.resgateRecompensa.create({ data: { clienteId: cliente.id, barbeariaId: shop.id, recompensaId: recompensa.id, pontosUsados: 100, status: 'CONFIRMADO' } });
        await tx.resgateRecompensa.create({ data: { clienteId: cliente.id, barbeariaId: shop.id, recompensaId: recompensa.id, pontosUsados: 500, status: 'CANCELADO' } });
        await tenantStorage.run({ barbeariaId: shop.id }, async () => {
          const dados = { tipo: 'ENTRADA' as const, categoria: 'Serviço', valor: 1,
            formaPagamento: 'PIX' as const, data: '2026-09-07', clienteId: cliente.id,
            itens: [{ servicoId: corte.id }, { servicoId: barba.id }], tipoDesconto: 'PONTOS' as const, pontosUsados: 50 };
          const previa = await FinanceiroService.simularDesconto(dados);
          assert.equal(previa.valorLiquido, 60);
          assert.equal(previa.valorComissao, 0);
          assert.equal(previa.pontosAcumulados, 16 + indice);
          const lanc = await FinanceiroService.criar(dados);
          assert.equal(Number(lanc.valor), 60);
          const credito = await tx.pontoFidelidade.findUniqueOrThrow({ where: { lancamentoId: lanc.id } });
          assert.equal(credito.pontos, previa.pontosAcumulados);
          const debito = await tx.pontoFidelidade.findFirstOrThrow({ where: { barbeariaId: shop.id, descricao: { contains: lanc.id }, pontos: -50 } });
          assert.equal(debito.clienteId, cliente.id);
          assert.equal((await ClienteService.obterSaldoFidelidade(cliente.id, shop.id)).saldoPontos, 1000 + indice * 1000 - 100 - 50 + 16 + indice);
          const semCliente = await FinanceiroService.simularDesconto({ ...dados, clienteId: undefined, pontosUsados: 0 });
          assert.equal(semCliente.pontosAcumulados, 0);
          await assert.rejects(() => FinanceiroService.simularDesconto({ ...dados, descontoReais: 1 }), /não é permitida/);
          await assert.rejects(() => FinanceiroService.simularDesconto({ ...dados, pontosUsados: 1.5 }), /inteiros/);
          const produto = await FinanceiroService.criar({ ...dados, categoria: 'Venda de Produto', itens: undefined,
            tipoDesconto: 'NENHUM', clienteId: undefined, barbeiroId: barbeiro.id, valor: 20 });
          assert.equal(Number(produto.valorComissao), 0);
          // Regressão: criação legada sem serviço/desconto deve preservar a regra aplicada.
          const avulso = { tipo: 'ENTRADA' as const, categoria: 'Serviço', valor: 35,
            formaPagamento: 'PIX' as const, data: '2026-09-07', barbeiroId: barbeiro.id };
          const zero = await FinanceiroService.criar(avulso);
          assert.equal(Number(zero.percentualComissao), 0);
          assert.equal(zero.baseComissaoAplicada, 'VALOR_LIQUIDO');
          await tx.barbeiro.update({ where: { id: barbeiro.id }, data: { comissaoPercent: 45 } });
          const manual = await FinanceiroService.criar(avulso);
          assert.equal(Number(manual.valorComissao), 15.75);
          assert.equal(Number(manual.valorLiquido), 19.25);
          assert.equal(Number(manual.percentualComissao), 45);
          // Mesmo uma mudança posterior da configuração não altera o percentual histórico.
          await tx.barbeiro.update({ where: { id: barbeiro.id }, data: { comissaoPercent: 50 } });
          await FinanceiroService.atualizar(manual.id, { valor: 40, valorComissao: 999, valorLiquido: 999,
            percentualComissao: 100, baseComissaoAplicada: 'VALOR_BRUTO', barbeariaId: b.id } as any, true);
          const editado = await tx.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: manual.id } });
          assert.equal(Number(editado.valorComissao), 18);
          assert.equal(Number(editado.valorLiquido), 22);
          assert.equal(Number(editado.percentualComissao), 45);
          assert.equal(editado.barbeariaId, shop.id);
          assert.equal(editado.baseComissaoAplicada, 'VALOR_LIQUIDO');
          await FinanceiroService.atualizar(manual.id, { formaPagamento: 'DINHEIRO', valorComissao: 123 } as any, true);
          assert.equal(Number((await tx.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: manual.id } })).valorComissao), 18);
          await FinanceiroService.atualizar(zero.id, { valor: 40 }, true);
          assert.equal(Number((await tx.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: zero.id } })).valorComissao), 0);
          await assert.rejects(() => FinanceiroService.atualizar(manual.id, { valor: -1 }, true), /Valor inválido/);
          await assert.rejects(() => FinanceiroService.atualizar(manual.id, { valor: NaN }, true), /Valor inválido/);
          // Aprovações antigas também não podem injetar uma comissão arbitrária.
          const aprovacao = await tx.aprovacaoEdicao.create({ data: { lancamentoId: manual.id, barbeiroId: barbeiro.id,
            acao: 'EDITAR', dadosNovos: { valor: 50, valorComissao: 50, percentualComissao: 100 } } });
          await AprovacaoService.aprovar(aprovacao.id, barbeiro.id);
          assert.equal(Number((await tx.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: manual.id } })).valorComissao), 22.5);
          await FinanceiroService.atualizar(manual.id, { barbeiroId: null } as any, true);
          assert.equal(Number((await tx.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: manual.id } })).valorComissao), 0);
          await FinanceiroService.atualizar(manual.id, { barbeiroId: barbeiro.id }, true);
          assert.equal(Number((await tx.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: manual.id } })).valorComissao), 25);
          // Base bruta usa itens congelados, não o valor pós-desconto nem o catálogo atual.
          await tx.configuracao.update({ where: { barbeariaId: shop.id }, data: { baseCalculoComissao: 'VALOR_BRUTO' } });
          const bruto = await FinanceiroService.criar({ ...dados, barbeiroId: barbeiro.id, clienteId: undefined,
            tipoDesconto: 'REAIS', descontoReais: 5, pontosUsados: 0 });
          await FinanceiroService.atualizar(bruto.id, { valor: 55 }, true);
          assert.equal(Number((await tx.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: bruto.id } })).valorComissao), 32.5);
          await tx.configuracao.update({ where: { barbeariaId: shop.id }, data: { baseCalculoComissao: 'VALOR_LIQUIDO' } });
          console.log('PASS comissão: snapshots, 35→40, campos forjados, percentual histórico/zero, validação, aprovação, remoção/retorno de barbeiro e base bruta congelada.');
          await tx.barbeiro.update({ where: { id: barbeiro.id }, data: { comissaoPercent: 40 } });
          assert.equal((await FinanceiroService.simularDesconto({ ...dados, barbeiroId: barbeiro.id })).valorComissao, 24);
          for (const fluxo of ['admin', 'barbeiro']) {
            const ag = await tx.agendamento.create({ data: { barbeariaId: shop.id, clienteId: cliente.id,
              barbeiroId: barbeiro.id, servicoId: corte.id, servicosIds: [corte.id, barba.id],
              dataHora: new Date('2026-09-07T15:00:00Z'), valorCobrado: 65, valorBruto: 65,
              itens: { create: [corte, barba].map((s, ordem) => ({ servicoId: s.id, barbeariaId: shop.id, nome: s.nome, preco: s.preco, duracaoMinutos: s.duracaoMinutos, ordem })) },
            } });
            const sim = await AgendamentoService.simularDesconto(ag.id, 'PONTOS', 0, 0, 10);
            await tx.servico.update({ where: { id: corte.id }, data: { preco: 100 } });
            const fechar = () => fluxo === 'admin'
              ? AgendamentoService.atualizar(ag.id, { status: 'CONCLUIDO', formaPagamento: 'PIX', tipoDesconto: 'PONTOS', pontosUsados: 10 } as any)
              : BarbeiroAppService.concluirAgendamento(ag.id, barbeiro.id, shop.id, 'PIX', 10);
            await fechar();
            assert.equal((await tx.pontoFidelidade.findUniqueOrThrow({ where: { agendamentoId: ag.id } })).pontos, sim.pontosAcumulados);
            assert.equal(Number((await tx.lancamentoFinanceiro.findFirstOrThrow({ where: { agendamentoId: ag.id } })).valor), sim.valorLiquido);
            await assert.rejects(fechar, /concluído/);
            await tx.servico.update({ where: { id: corte.id }, data: { preco: 40 } });
          }
          await tx.configuracaoFidelidade.update({ where: { barbeariaId: shop.id }, data: { regrasPorServico: [] } });
          const baseBruta = await FinanceiroService.criar(dados);
          assert.equal((await tx.pontoFidelidade.findUniqueOrThrow({ where: { lancamentoId: baseBruta.id } })).pontos, 65);
          await tx.configuracao.update({ where: { barbeariaId: shop.id }, data: { baseCalculoPontos: 'VALOR_LIQUIDO' } });
          const baseLiquida = await FinanceiroService.criar(dados);
          assert.equal((await tx.pontoFidelidade.findUniqueOrThrow({ where: { lancamentoId: baseLiquida.id } })).pontos, 60);
        });
      }
      console.log('PASS PostgreSQL: manual + admin + barbeiro, duas unidades, comissão zero/positiva/produto, prévia versus crédito, débito e recompensa sem dupla subtração, repetição de fechamento.');
      throw rollback;
    }, { timeout: 300000, maxWait: 10000 });
  } catch (error) { if (error !== rollback) throw error; }
  assert.equal(await db.barbearia.count({ where: { nome: prefixo } }), 0);
  console.log('PASS rollback: nenhuma fixture persistiu. Concorrência não coberta por esta transação única.');
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Falha no teste'); process.exitCode = 1; })
  .finally(() => db.$disconnect());
