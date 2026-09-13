import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { AddressInfo } from "node:net";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { authConfig } from "../src/config/auth";

for (const k of ["DATABASE_URL", "DIRECT_URL"]) {
  const u = new URL(process.env[k]!);
  assert.equal(u.hostname, "altaria.proxy.rlwy.net");
  assert.equal(u.port, "49931");
  console.log("Banco de teste:", u.hostname, u.port, u.pathname);
}
const db = new PrismaClient();
const ids: string[] = [];
async function main() {
  const { default: app } = await import("../dist/app");
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    for (let i = 0; i < 2; i++) {
      const loja = await db.barbearia.create({
        data: {
          nome: "QA estoque temporário",
          slug: `qa-estoque-${randomUUID()}`,
        },
      });
      ids.push(loja.id);
    }
    const [a, b] = ids;
    const produto = async (
      barbeariaId: string,
      nome: string,
      quantidade: number,
      precoVenda: number | null,
    ) =>
      db.estoque.create({
        data: {
          barbeariaId,
          nome,
          quantidade,
          precoVenda,
          custo: 2,
          unidade: "unidade",
          categoria: "Teste",
        },
      });
    const p = await produto(a, "A teste", 10, 10.1),
      q = await produto(a, "B teste", 8, 20.2),
      externo = await produto(b, "Outra loja", 5, 5),
      sem = await produto(a, "Sem preço", 2, null);
    const legado = await db.vendaProduto.create({
      data: {
        barbeariaId: a,
        estoqueId: p.id,
        nomeProduto: p.nome,
        quantidade: 1,
        precoVenda: 10,
        custoUnitario: 2,
        lucro: 8,
        formaPagamento: "PIX",
      },
    });
    const post = async (
      itens: unknown,
      chaveRequisicao = randomUUID(),
      loja = a,
      desconto: Record<string, unknown> = {},
    ) => {
      const token = jwt.sign(
        { id: randomUUID(), papel: "ADMIN", barbeariaId: loja },
        authConfig.secret,
        { expiresIn: "5m" },
      );
      const r = await fetch(base + "/estoque/vender-carrinho", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          itens,
          formaPagamento: "PIX",
          chaveRequisicao,
          total: 0.01,
          ...desconto,
        }),
      });
      return {
        status: r.status,
        body: (await r.json()) as { vendaId: string; totalVenda: number },
      };
    };
    for (const quantidade of [0, -1, 1.5])
      assert.equal((await post([{ estoqueId: p.id, quantidade }])).status, 400);
    assert.equal((await post([])).status, 400);
    assert.equal(
      (await post([{ estoqueId: externo.id, quantidade: 1 }])).status,
      400,
    );
    assert.equal(
      (await post([{ estoqueId: sem.id, quantidade: 1 }])).status,
      400,
    );
    const chave = randomUUID();
    const r = await post(
      [
        { estoqueId: p.id, quantidade: 1 },
        { estoqueId: p.id, quantidade: 1 },
        { estoqueId: q.id, quantidade: 2 },
      ],
      chave,
    );
    assert.equal(r.status, 201);
    assert.equal(r.body.totalVenda, 60.6);
    const venda = await db.vendaEstoque.findUniqueOrThrow({
      where: { id: r.body.vendaId },
      include: { itens: true, lancamento: true },
    });
    assert.equal(venda.itens.length, 2);
    assert.equal(Number(venda.lancamento.valor), 60.6);
    assert.equal(venda.lancamento.servicoId, null);
    assert.equal(
      (await db.estoque.findUniqueOrThrow({ where: { id: p.id } })).quantidade,
      8,
    );
    assert.equal(
      (await post([{ estoqueId: p.id, quantidade: 2 }], chave)).status,
      409,
    );
    assert.equal(await db.vendaEstoque.count({ where: { barbeariaId: a } }), 1);
    const antes = await db.estoque.findUniqueOrThrow({ where: { id: p.id } });
    assert.equal(
      (
        await post([
          { estoqueId: p.id, quantidade: 1 },
          { estoqueId: "zz-inexistente", quantidade: 1 },
        ])
      ).status,
      400,
    );
    assert.equal(
      (await db.estoque.findUniqueOrThrow({ where: { id: p.id } })).quantidade,
      antes.quantidade,
    );
    const ultimo = await produto(a, "Última unidade", 1, 8);
    const disputa = await Promise.all([
      post([{ estoqueId: ultimo.id, quantidade: 1 }]),
      post([{ estoqueId: ultimo.id, quantidade: 1 }]),
    ]);
    assert.deepEqual(disputa.map((r) => r.status).sort(), [201, 409]);
    assert.equal(
      (await db.estoque.findUniqueOrThrow({ where: { id: ultimo.id } }))
        .quantidade,
      0,
    );
    assert.equal(
      (await db.vendaProduto.findUniqueOrThrow({ where: { id: legado.id } }))
        .vendaId,
      null,
    );
    assert.equal(
      (await db.estoque.findUniqueOrThrow({ where: { id: externo.id } }))
        .quantidade,
      5,
    );
    await db.configuracao.create({ data: { barbeariaId: a } });
    await db.configuracaoFidelidade.create({
      data: {
        barbeariaId: a,
        ativo: true,
        resgatePontosAtivo: true,
        valorPorPonto: 0.1,
        percentualMaxPontos: 30,
        descontoMaxReais: 25,
        descontoMaxPercentual: 20,
      },
    });
    const usuario = await db.usuario.create({
      data: {
        barbeariaId: a,
        nome: "QA descontos",
        email: `qa-${randomUUID()}@example.invalid`,
        senha: "sem-login",
        cliente: { create: { barbeariaId: a } },
      },
      include: { cliente: true },
    });
    const clienteId = usuario.cliente!.id;
    await db.pontoFidelidade.create({
      data: { barbeariaId: a, clienteId, pontos: 1000, descricao: "QA saldo" },
    });
    const recompensa = await db.recompensa.create({
      data: {
        barbeariaId: a,
        nome: "QA reserva",
        tipo: "DESCONTO_REAIS",
        pontosNecessarios: 50,
      },
    });
    await db.resgateRecompensa.create({
      data: {
        barbeariaId: a,
        clienteId,
        recompensaId: recompensa.id,
        pontosUsados: 50,
        status: "PENDENTE",
      },
    });
    const c = await produto(a, "QA desconto A", 30, 40),
      d = await produto(a, "QA desconto B", 30, 60);
    const carrinho = [
      { estoqueId: c.id, quantidade: 1 },
      { estoqueId: d.id, quantidade: 1 },
    ];
    const vendaDesconto = async (
      dados: Record<string, unknown>,
      valor: number,
    ) => {
      const r = await post(carrinho, randomUUID(), a, dados);
      assert.equal(r.status, 201);
      assert.equal(r.body.totalVenda, valor);
      const v = await db.vendaEstoque.findUniqueOrThrow({
        where: { id: r.body.vendaId },
        include: { itens: true, lancamento: true },
      });
      assert.equal(Number(v.valorBruto), 100);
      assert.equal(Number(v.valorDesconto), 100 - valor);
      assert.equal(Number(v.lancamento.valor), valor);
      assert.equal(
        v.itens.reduce((s, i) => s + Number(i.descontoRateado), 0),
        100 - valor,
      );
      assert.equal(
        v.itens.reduce((s, i) => s + Number(i.lucro), 0),
        valor - 4,
      );
      return v;
    };
    await vendaDesconto({ tipoDesconto: "REAIS", descontoReais: 10 }, 90);
    await vendaDesconto(
      { tipoDesconto: "PERCENTUAL", descontoPercentual: 15 },
      85,
    );
    const vp = await vendaDesconto(
      { tipoDesconto: "PONTOS", pontosUsados: 100, clienteId },
      90,
    );
    const debito = await db.pontoFidelidade.findUniqueOrThrow({
      where: { lancamentoId: vp.lancamentoId },
    });
    assert.equal(debito.pontos, -100);
    assert.equal(debito.saldoApos, 850);
    assert.equal(debito.tipo, "RESGATE");
    for (const dados of [
      { tipoDesconto: "REAIS", descontoReais: -1 },
      { tipoDesconto: "REAIS", descontoReais: 26 },
      { tipoDesconto: "REAIS", descontoReais: 101 },
      { tipoDesconto: "PERCENTUAL", descontoPercentual: 21 },
      { tipoDesconto: "PERCENTUAL", descontoPercentual: 101 },
      { tipoDesconto: "PONTOS", pontosUsados: 1 },
      { tipoDesconto: "PONTOS", pontosUsados: 1.5, clienteId },
      { tipoDesconto: "PONTOS", pontosUsados: 301, clienteId },
      { tipoDesconto: "PONTOS", pontosUsados: 900, clienteId },
    ])
      assert.equal((await post(carrinho, randomUUID(), a, dados)).status, 400);
    await db.configuracaoFidelidade.update({
      where: { barbeariaId: a },
      data: { resgatePontosAtivo: false },
    });
    assert.equal(
      (
        await post(carrinho, randomUUID(), a, {
          tipoDesconto: "PONTOS",
          pontosUsados: 10,
          clienteId,
        })
      ).status,
      400,
    );
    await db.configuracaoFidelidade.update({
      where: { barbeariaId: a },
      data: { resgatePontosAtivo: true },
    });
    // Falha real depois do débito: custo do item excede precisão do lucro na gravação.
    const falha = await db.estoque.create({
      data: {
        barbeariaId: a,
        nome: "QA rollback após pontos",
        quantidade: 2,
        unidade: "unidade",
        custo: 99999999,
        precoVenda: 1,
      },
    });
    const antesPontos = await db.pontoFidelidade.count({
      where: { clienteId },
    });
    const antesVendas = await db.vendaEstoque.count({
      where: { barbeariaId: a },
    });
    assert.equal(
      (
        await post([{ estoqueId: falha.id, quantidade: 2 }], randomUUID(), a, {
          tipoDesconto: "PONTOS",
          pontosUsados: 1,
          clienteId,
        })
      ).status,
      500,
    );
    assert.equal(
      await db.pontoFidelidade.count({ where: { clienteId } }),
      antesPontos,
    );
    assert.equal(
      await db.vendaEstoque.count({ where: { barbeariaId: a } }),
      antesVendas,
    );
    assert.equal(
      (await db.estoque.findUniqueOrThrow({ where: { id: falha.id } }))
        .quantidade,
      2,
    );
    // Duas operações disputam os últimos 100 pontos, em produtos distintos.
    await db.pontoFidelidade.create({
      data: {
        barbeariaId: a,
        clienteId,
        pontos: -750,
        descricao: "QA reduzir saldo para concorrência",
      },
    });
    const concorrencia = await Promise.all([
      post([{ estoqueId: c.id, quantidade: 1 }], randomUUID(), a, {
        tipoDesconto: "PONTOS",
        pontosUsados: 100,
        clienteId,
      }),
      post([{ estoqueId: d.id, quantidade: 1 }], randomUUID(), a, {
        tipoDesconto: "PONTOS",
        pontosUsados: 100,
        clienteId,
      }),
    ]);
    assert.equal(concorrencia.filter((r) => r.status === 201).length, 1);
    assert.ok(concorrencia.some((r) => r.status === 400 || r.status === 409));
    const saldoFinal = await db.pontoFidelidade.aggregate({
      where: { clienteId },
      _sum: { pontos: true },
    });
    assert.equal(saldoFinal._sum.pontos, 50); // 50 reservados: saldo utilizável zero.
    const responsavel = randomUUID();
    const request = async (path: string, method = 'GET', body?: unknown, loja = a, papel = 'ADMIN') => {
      const token = jwt.sign({ id: responsavel, papel, barbeariaId: loja }, authConfig.secret, { expiresIn: '10m' });
      const response = await fetch(base + path, { method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    };
    const caminho = `/estoque/vendas/${vp.id}/estornar`;
    const motivo = { motivo: 'QA devolução integral' };
    assert.equal((await request(caminho, 'POST', motivo, b)).status, 404);
    assert.equal((await request(caminho, 'POST', motivo, a, 'CLIENTE')).status, 403);
    assert.equal((await request(caminho, 'POST', { motivo: '' })).status, 400);
    for (const alteracao of [{ valor: 1 }, { formaPagamento: 'DINHEIRO' }, { data: '2026-09-01' }, { clienteId: '' }, { categoria: 'Aporte' }, { tipo: 'SAIDA' }])
      assert.equal((await request(`/financeiro/${vp.lancamentoId}`, 'PUT', alteracao)).status, 400);
    assert.equal((await request(`/financeiro/${vp.lancamentoId}`, 'DELETE')).status, 400);
    const perfilAntes = await request(`/clientes/${clienteId}`);
    assert.equal(perfilAntes.status, 200);
    assert.equal(perfilAntes.body.totalVisitas, 0);
    assert.ok(perfilAntes.body.totalGasto > 90);
    assert.ok(perfilAntes.body.ticketMedio > 0);
    assert.ok(perfilAntes.body.agendamentos.some((l: { servico: string }) => l.servico.startsWith('Compra de produtos')));
    const estoqueAntes = await db.estoque.findMany({ where: { id: { in: [c.id, d.id] } } });
    const originalAntes = await db.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: vp.lancamentoId } });
    assert.equal((await request(caminho, 'POST', motivo)).status, 200);
    const estornada = await db.vendaEstoque.findUniqueOrThrow({ where: { id: vp.id }, include: { estornoLancamento: true, lancamento: true } });
    assert.deepEqual(estornada.lancamento, originalAntes);
    assert.equal(estornada.estornadoPorId, responsavel);
    assert.equal(estornada.motivoEstorno, motivo.motivo);
    assert.equal(Number(estornada.estornoLancamento!.valor), 90);
    assert.equal(estornada.estornoLancamento!.tipo, 'SAIDA');
    const devolucao = await db.pontoFidelidade.findUniqueOrThrow({ where: { lancamentoId: estornada.estornoLancamentoId! } });
    assert.equal(devolucao.pontos, 100); assert.equal(devolucao.tipo, 'ESTORNO');
    for (const item of estoqueAntes) assert.equal((await db.estoque.findUniqueOrThrow({ where: { id: item.id } })).quantidade, item.quantidade + 1);
    const repetir = await request(caminho, 'POST', motivo);
    assert.equal(repetir.status, 200); assert.equal(repetir.body.jaEstornada, true);
    assert.equal(await db.pontoFidelidade.count({ where: { lancamentoId: estornada.estornoLancamentoId! } }), 1);
    assert.equal((await request(`/financeiro/${estornada.estornoLancamentoId}`, 'DELETE')).status, 400);
    assert.equal((await request(`/financeiro/${estornada.estornoLancamentoId}`, 'PUT', { valor: 1 })).status, 400);
    const perfilDepois = await request(`/clientes/${clienteId}`);
    assert.equal(perfilDepois.body.totalVisitas, 0);
    assert.equal(perfilDepois.body.totalGasto, perfilAntes.body.totalGasto - 90);
    assert.equal(perfilDepois.body.totalCompras, perfilAntes.body.totalCompras - 1);
    assert.equal(perfilDepois.body.ticketMedio, perfilDepois.body.totalGasto / perfilDepois.body.totalCompras);
    const disputaEstorno = await Promise.all([
      request(`/estoque/vendas/${venda.id}/estornar`, 'POST', motivo),
      request(`/estoque/vendas/${venda.id}/estornar`, 'POST', motivo),
    ]);
    assert.ok(disputaEstorno.every(r => [200, 409].includes(r.status)));
    assert.ok(disputaEstorno.some(r => r.status === 200));
    const corrida = await db.vendaEstoque.findUniqueOrThrow({ where: { id: venda.id } });
    assert.equal(await db.lancamentoFinanceiro.count({ where: { id: corrida.estornoLancamentoId! } }), 1);
    assert.equal((await db.estoque.findUniqueOrThrow({ where: { id: p.id } })).quantidade, 10);
    // Falha APÓS devolução de estoque e criação financeira: tudo deve reverter.
    const falhaEstorno = await vendaDesconto({ tipoDesconto: 'PONTOS', pontosUsados: 100, clienteId }, 90);
    const debitofalha = await db.pontoFidelidade.findUniqueOrThrow({ where: { lancamentoId: falhaEstorno.lancamentoId } });
    await db.pontoFidelidade.update({ where: { id: debitofalha.id }, data: { pontos: -99 } });
    const antesFalha = await db.estoque.findUniqueOrThrow({ where: { id: c.id } });
    const financeirosAntes = await db.lancamentoFinanceiro.count({ where: { barbeariaId: a } });
    assert.equal((await request(`/estoque/vendas/${falhaEstorno.id}/estornar`, 'POST', motivo)).status, 400);
    assert.equal((await db.estoque.findUniqueOrThrow({ where: { id: c.id } })).quantidade, antesFalha.quantidade);
    assert.equal((await db.vendaEstoque.findUniqueOrThrow({ where: { id: falhaEstorno.id } })).estornadaEm, null);
    assert.equal(await db.lancamentoFinanceiro.count({ where: { barbeariaId: a } }), financeirosAntes);
    await db.pontoFidelidade.update({ where: { id: debitofalha.id }, data: { pontos: -100 } });
    assert.equal((await request(`/estoque/vendas/${falhaEstorno.id}/estornar`, 'POST', motivo)).status, 200);
    console.log('PASS estorno: sucesso integral, trilha original, pontos, idempotência, concorrência, rollback após devolução, permissões, financeiro protegido e perfil líquido sem visitas extras.');
    console.log(
      "PASS descontos: reais, percentual, pontos, limites iguais aos serviços, reserva pendente, rateio, histórico/lucro/financeiro, rollback após débito e concorrência de saldo.",
    );
    console.log(
      "PASS: API compilada, total servidor, linhas repetidas, venda única, idempotência, estoque insuficiente, rollback, concorrência, isolamento, legado e serviços separados.",
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
    await db.vendaProduto.deleteMany({ where: { barbeariaId: { in: ids } } });
    await db.vendaEstoque.deleteMany({ where: { barbeariaId: { in: ids } } });
    await db.barbearia.deleteMany({ where: { id: { in: ids } } });
    assert.equal(await db.barbearia.count({ where: { id: { in: ids } } }), 0);
    await db.$disconnect();
    const { prisma } = await import("../dist/lib/prisma");
    await prisma.$disconnect();
    console.log("PASS: fixtures removidas.");
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
