import assert from 'node:assert/strict';
import express, { type Request, type Response } from 'express';
import type { AddressInfo } from 'node:net';
import type { AtorAgenda } from '../src/services/acessoAgenda.service';

// Fresh disposable local database only. No .env loading, no provider calls and
// no cleanup/deletion: the external runner owns discarding this fixture DB.
assert.equal(process.env.ALLOW_LOCAL_SECURITY_TEST, '1');
for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
  const url = new URL(process.env[key] ?? '');
  assert.equal(url.protocol, 'postgresql:');
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.port, '55439');
  assert.equal(url.pathname, '/valen_autorizacao_test');
  assert.equal(url.username, 'valen_test');
  assert.equal(url.search, '');
}
process.env.JWT_SECRET = 'postgres-autorizacao-admin-segredo-sintetico';
process.env.JWT_SECRET_CLIENTE = 'postgres-autorizacao-cliente-segredo-sintetico';
process.env.JWT_SECRET_BARBEIRO = 'postgres-autorizacao-barbeiro-segredo-sintetico';
process.env.NODE_ENV = 'test';
delete process.env.RESEND_API_KEY;

const data = '2099-10-02';
const horario = (hora: string) => `${data}T${hora}:00-03:00`;

async function main() {
  const { prisma } = await import('../src/lib/prisma');
  const { tenantStorage } = await import('../src/lib/als');
  const { AgendamentoService } = await import('../src/services/agendamento.service');
  const { ClienteAppService } = await import('../src/services/clienteApp.service');
  const { ClienteService } = await import('../src/services/cliente.service');
  const { ServicoService } = await import('../src/services/servico.service');
  const { ConfiguracaoService } = await import('../src/services/configuracao.service');
  const { ConfiguracaoController } = await import('../src/controllers/configuracao.controller');
  const { BloqueioService } = await import('../src/services/bloqueio.service');
  const { iniciarSessao } = await import('../src/services/sessao.service');
  const { default: publicoRoutes } = await import('../src/routes/publico.routes');
  const { default: tenantRoutes } = await import('../src/routes/tenantRoutes');
  const { default: agendamentoRoutes } = await import('../src/routes/agendamento.routes');
  const { bloqueioRoutes } = await import('../src/routes/bloqueio.routes');
  const { AgendamentoController } = await import('../src/controllers/agendamento.controller');
  const { authMiddleware } = await import('../src/middlewares/auth.middleware');
  const { errorMiddleware } = await import('../src/middlewares/error.middleware');
  let server: ReturnType<typeof express.application.listen> | undefined;
  try {
    const [connection] = await prisma.$queryRaw<{ banco: string; host: string }[]>`SELECT current_database() AS banco, host(inet_server_addr()) AS host`;
    assert.deepEqual(connection, { banco: 'valen_autorizacao_test', host: '127.0.0.1' });
    assert.equal(await prisma.usuario.count(), 0, 'fresh fixture database required');
    assert.equal(await prisma.barbearia.count(), 0);
    const a = await prisma.barbearia.create({ data: { nome: 'Sintética A', slug: 'autorizacao-a' } });
    const b = await prisma.barbearia.create({ data: { nome: 'Sintética B', slug: 'autorizacao-b' } });
    const schedule = Object.fromEntries(['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'].map(dia => [dia, { fechado: false, abertura: '08:00', fechamento: '22:00', temAlmoco: false }]));
    for (const shop of [a, b]) {
      await prisma.configuracao.create({ data: { barbeariaId: shop.id, horariosFuncionamento: schedule } });
      await prisma.configuracaoFidelidade.create({ data: { barbeariaId: shop.id, ativo: true, pontosPorVisita: 10 } });
    }
    const adminUser = await prisma.usuario.create({ data: { nome: 'Dono A', email: 'admin-a@example.test', senha: 'hash-fixture', papel: 'ADMIN', barbeariaId: a.id, emailVerificado: true } });
    const admin: AtorAgenda = { id: adminUser.id, papel: 'ADMIN', barbeariaId: a.id };
    async function criarBarbeiro(shopId: string, numero: number) {
      const user = await prisma.usuario.create({ data: { nome: `Barbeiro ${numero}`, email: `barber-${numero}@example.test`, senha: 'hash-fixture', papel: 'BARBEIRO', barbeariaId: shopId, emailVerificado: true } });
      const barber = await prisma.barbeiro.create({ data: { usuarioId: user.id, barbeariaId: shopId, especialidades: [], comissaoPercent: 40 } });
      return { ...barber, user, ator: { id: user.id, papel: 'BARBEIRO' as const, barbeariaId: shopId } };
    }
    const b1 = await criarBarbeiro(a.id, 1); const b2 = await criarBarbeiro(a.id, 2); const b3 = await criarBarbeiro(b.id, 3);
    async function criarCliente(shopId: string, numero: number, legacy = false) {
      const user = await prisma.usuario.create({ data: { nome: `Cliente ${numero}`, email: `customer-${numero}@example.test`, senha: 'hash-fixture', papel: 'CLIENTE', barbeariaId: legacy ? shopId : null, emailVerificado: true } });
      const customer = await prisma.cliente.create({ data: { usuarioId: user.id, barbeariaId: legacy ? shopId : null, telefone: `1190000000${numero}`, observacoes: 'Perfil privado sintético', dataNascimento: new Date('1990-01-01T12:00:00Z') } });
      await prisma.clienteBarbearia.create({ data: { clienteId: customer.id, barbeariaId: shopId } });
      return { ...customer, user, ator: { id: user.id, papel: 'CLIENTE' as const, barbeariaId: shopId } };
    }
    const c1 = await criarCliente(a.id, 1); const c2 = await criarCliente(b.id, 2); const legacy = await criarCliente(a.id, 3, true);
    const s1 = await prisma.servico.create({ data: { barbeariaId: a.id, nome: 'Corte A', preco: 35, duracaoMinutos: 30 } });
    const s2 = await prisma.servico.create({ data: { barbeariaId: a.id, nome: 'Barba A', preco: 20, duracaoMinutos: 20 } });
    const s3 = await prisma.servico.create({ data: { barbeariaId: b.id, nome: 'Corte B', preco: 100, duracaoMinutos: 40 } });
    const base = { barbeariaId: a.id, clienteId: c1.id, barbeiroId: b1.id, servicoId: s1.id, servicosIds: [s1.id], dataHora: horario('10:00') };
    const own = await tenantStorage.run({ barbeariaId: a.id }, () => AgendamentoService.criar(base, admin));
    const colleague = await AgendamentoService.criar({ ...base, barbeiroId: b2.id, dataHora: horario('11:00') }, admin);
    const foreign = await AgendamentoService.criar({ barbeariaId: b.id, clienteId: c2.id, barbeiroId: b3.id, servicoId: s3.id, servicosIds: [s3.id], dataHora: horario('10:00') }, c2.ator);
    const block = await BloqueioService.criar(b3.id, horario('17:00'), horario('18:00'), 'Motivo privado B', b3.ator);
    const userBefore = await prisma.usuario.findUniqueOrThrow({ where: { id: b1.user.id } });
    const customerBefore = await prisma.cliente.findUniqueOrThrow({ where: { id: c1.id } });
    const ownBefore = await prisma.agendamento.findUniqueOrThrow({ where: { id: own.id } });

    for (const operation of ['update', 'connect', 'delete', 'upsert', 'deleteMany', 'create']) {
      await assert.rejects(AgendamentoService.atualizar(own.id, { barbeiro: { [operation]: { usuario: { update: { papel: 'ADMIN', senha: 'canary' } } } } }, b1.ator));
      await assert.rejects(ClienteService.atualizar(c1.id, { usuario: { [operation]: { papel: 'ADMIN', senha: 'canary' } } } as never, a.id));
    }
    for (const payload of [{ barbeariaId: b.id }, { clienteId: c2.id }, { valorCobrado: 0 }, { status: { set: 'CONCLUIDO' } }]) await assert.rejects(AgendamentoService.atualizar(own.id, payload, b1.ator));
    await assert.rejects(ServicoService.atualizar(s1.id, { barbearia: { update: { usuarios: { deleteMany: {} } } } } as never));
    await assert.rejects(ConfiguracaoService.atualizar({ barbearia: { update: { usuarios: { deleteMany: {} } } } }, a.id));
    assert.deepEqual(await prisma.usuario.findUnique({ where: { id: b1.user.id } }), userBefore);
    assert.deepEqual(await prisma.cliente.findUnique({ where: { id: c1.id } }), customerBefore);
    assert.deepEqual(await prisma.agendamento.findUnique({ where: { id: own.id } }), ownBefore);
    assert.equal(await prisma.usuario.count(), 7);
    console.log('PASS PostgreSQL VLB-04: nested relation/operator attempts leave role, credential, customer, appointment and tenant rows unchanged');

    for (const [field, value] of [['barbeiroId', b3.id], ['clienteId', c2.id], ['servicoId', s3.id]] as const) await assert.rejects(AgendamentoService.criar({ ...base, [field]: value }, admin));
    await assert.rejects(AgendamentoService.criar({ ...base, servicosIds: [s1.id, s3.id] }, admin));
    await assert.rejects(AgendamentoService.criar({ ...base, servicosIds: [s1.id, 'missing'] }, admin));
    await assert.rejects(AgendamentoService.criar({ ...base, clienteId: c2.id }, c1.ator));
    await assert.rejects(AgendamentoService.criar(base, undefined as never));
    await assert.rejects(AgendamentoService.atualizar(own.id, { servicoId: s3.id }, admin));
    await assert.rejects(AgendamentoService.atualizar(own.id, { barbeiroId: b3.id }, admin));
    assert.equal(await prisma.agendamento.count(), 3);
    await assert.rejects(AgendamentoService.buscarPorId(colleague.id, b1.ator));
    await assert.rejects(AgendamentoService.buscarPorId(foreign.id, admin));
    await assert.rejects(AgendamentoService.simularDesconto(colleague.id, b1.ator, 'NENHUM'));
    for (const status of ['CONCLUIDO', 'CANCELADO']) await assert.rejects(AgendamentoService.atualizar(colleague.id, { status }, b1.ator));
    await assert.rejects(AgendamentoService.atualizar(own.id, { barbeiroId: b2.id }, b1.ator));
    await assert.rejects(AgendamentoService.horariosDisponivies(b3.id, data, admin));
    await assert.rejects(AgendamentoService.horariosDisponivies(b2.id, data, b1.ator));
    assert.deepEqual(await BloqueioService.listar({ barbeiroId: b3.id }, admin), []);
    await assert.rejects(BloqueioService.remover(block.id, admin));
    await assert.rejects(BloqueioService.criar(b3.id, horario('19:00'), horario('20:00'), 'forged', admin));
    assert.ok(await prisma.bloqueioAgenda.findUnique({ where: { id: block.id } }));
    assert.equal(await prisma.lancamentoFinanceiro.count(), 0);
    assert.equal(await prisma.pontoFidelidade.count(), 0);
    console.log('PASS PostgreSQL VLB-05/08/10: foreign barber/service/customer, colleague reads/closes, private schedule blocks and mixed-reference bookings denied');

    await tenantStorage.run({ barbeariaId: a.id }, () => AgendamentoService.atualizar(own.id, { dataHora: horario('09:00'), servicosIds: [s1.id, s2.id] }, admin));
    const remarcado = await prisma.agendamento.findUniqueOrThrow({ where: { id: own.id }, include: { itens: true, historicoRemarcacoes: true } });
    assert.equal(Number(remarcado.valorCobrado), 55);
    assert.equal(remarcado.itens.reduce((total, item) => total + item.duracaoMinutos, 0), 50);
    assert.equal(remarcado.historicoRemarcacoes.length, 1);
    assert.equal(remarcado.historicoRemarcacoes[0].usuarioAcaoId, admin.id);
    const receipt = await ClienteAppService.agendar(c1.id, a.id, { barbeiroId: b1.id, servicosIds: [s1.id], data, hora: '12:00' }, c1.user.id);
    assert.deepEqual(Object.keys(receipt).sort(), ['barbeiro', 'dataHora', 'id', 'servico', 'status']);
    await ClienteService.atualizar(c1.id, { observacoes: 'Observação permitida' }, a.id);
    await tenantStorage.run({ barbeariaId: a.id }, () => ServicoService.atualizar(s2.id, { nome: 'Barba atualizada' }));
    await tenantStorage.run({ barbeariaId: a.id }, () => ConfiguracaoService.atualizar({ baseCalculoComissao: 'VALOR_BRUTO' }, a.id));
    const closes = await Promise.allSettled([
      tenantStorage.run({ barbeariaId: a.id }, () => AgendamentoService.atualizar(own.id, { status: 'CONCLUIDO', formaPagamento: 'PIX' }, b1.ator)),
      tenantStorage.run({ barbeariaId: a.id }, () => AgendamentoService.atualizar(own.id, { status: 'CONCLUIDO', formaPagamento: 'PIX' }, b1.ator)),
    ]);
    assert.equal(closes.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(await prisma.lancamentoFinanceiro.count({ where: { agendamentoId: own.id } }), 1);
    assert.equal(await prisma.pontoFidelidade.count({ where: { agendamentoId: own.id } }), 1);
    assert.equal(Number((await prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { agendamentoId: own.id } })).valorComissao), 22);
    console.log('PASS PostgreSQL valid flows: admin rescheduling/multi-service snapshots/history, customer receipt, allowed profile/catalog/settings edits and one financial close/loyalty credit under concurrency');

    // Full middleware+router stack with real signed HttpOnly session cookies.
    const app = express(); app.use(express.json());
    app.post('/__fixture/:portal', async (req: Request, res: Response, next) => {
      try {
        const portal = req.params.portal as 'admin' | 'barbeiro' | 'cliente' | 'tenant';
        const ids = { admin: admin.id, barbeiro: b1.user.id, cliente: c1.user.id, tenant: legacy.user.id };
        if (!(portal in ids)) return res.sendStatus(404);
        await iniciarSessao(req, res, ids[portal], portal); res.json({ ok: true });
      } catch (error) { next(error); }
    });
    app.put('/configuracoes/minha-barbearia', authMiddleware, ConfiguracaoController.updateMinhaBarbearia);
    app.use('/agendamentos', agendamentoRoutes); app.use('/bloqueios', bloqueioRoutes);
    app.use('/publico', publicoRoutes); app.use('/b', tenantRoutes);
    app.get('/relatorios/agenda/:barbeiroId', authMiddleware, AgendamentoController.horarios);
    app.use(errorMiddleware);
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server!.once('listening', resolve));
    const baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const headers = { 'X-Valen-Client': 'web', Origin: 'http://localhost:5173', 'content-type': 'application/json' };
    const cookies: Record<string, string> = {};
    for (const portal of ['admin', 'barbeiro', 'cliente', 'tenant']) {
      const login = await fetch(`${baseURL}/__fixture/${portal}`, { method: 'POST', headers });
      assert.equal(login.status, 200); cookies[portal] = login.headers.get('set-cookie')!.split(';')[0];
    }
    async function request(path: string, method: string, portal?: string, body?: object) {
      return fetch(`${baseURL}${path}`, { method, headers: { ...headers, ...(portal ? { Cookie: cookies[portal], 'X-Valen-Portal': portal } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    }
    for (const path of ['/publico/agendamentos', `/b/${a.slug}/agendar`, `/b/${a.slug}/app/agendar`]) assert.equal((await request(path, 'POST', undefined, { clienteId: c1.id })).status, 401);
    assert.equal((await request(`/publico/fidelidade?telefone=${c1.telefone}`, 'GET')).status, 401);
    assert.equal((await request(`/agendamentos/${colleague.id}`, 'GET', 'barbeiro')).status, 404);
    assert.equal((await request(`/agendamentos/${colleague.id}`, 'PUT', 'barbeiro', { status: 'CONCLUIDO' })).status, 404);
    assert.equal((await request(`/relatorios/agenda/${b3.id}?data=${data}`, 'GET', 'admin')).status, 404);
    assert.equal((await request(`/relatorios/agenda/${b2.id}?data=${data}`, 'GET', 'barbeiro')).status, 403);
    assert.deepEqual(await (await request(`/bloqueios?barbeiroId=${b3.id}`, 'GET', 'admin')).json(), []);
    assert.equal((await request(`/bloqueios/${block.id}`, 'DELETE', 'admin')).status, 404);
    assert.equal((await request(`/b/${b.slug}/app/meus-agendamentos`, 'GET', 'tenant')).status, 404);
    assert.equal((await request(`/b/${a.slug}/app/meus-agendamentos`, 'GET', 'tenant')).status, 200);
    assert.equal((await request(`/publico/fidelidade?telefone=${c2.telefone}&barbeariaId=${a.id}`, 'GET', 'cliente')).status, 400);
    assert.equal((await request(`/publico/fidelidade?barbeariaId=${b.id}`, 'GET', 'cliente')).status, 404);
    assert.equal((await request('/publico/agendamentos', 'POST', 'cliente', { ...base, dataHora: horario('13:00'), clienteId: c2.id })).status, 400);
    const beforeSettings = await prisma.barbearia.findUniqueOrThrow({ where: { id: a.id } });
    assert.equal((await request('/configuracoes/minha-barbearia', 'PUT', 'admin', { nome: { set: 'canary' } })).status, 400);
    assert.equal((await request('/configuracoes/minha-barbearia', 'PUT', 'admin', { barbeariaId: b.id })).status, 400);
    assert.deepEqual(await prisma.barbearia.findUniqueOrThrow({ where: { id: a.id } }), beforeSettings);
    assert.equal((await request('/configuracoes/minha-barbearia', 'PUT', 'admin', { nome: 'Nome atualizado', slug: a.slug })).status, 200);
    const safePublic = await request('/publico/agendamentos', 'POST', 'cliente', { barbeariaId: a.id, barbeiroId: b1.id, servicoId: s1.id, dataHora: horario('13:00') });
    assert.equal(safePublic.status, 201, await safePublic.clone().text());
    const publicBody = await safePublic.json();
    assert.deepEqual(Object.keys(publicBody).sort(), ['barbeiro', 'dataHora', 'id', 'servico', 'status']);
    const safeLegacy = await request(`/b/${a.slug}/agendar`, 'POST', 'tenant', { barbeiroId: b1.id, servicoId: s1.id, data, hora: '14:00' });
    assert.equal(safeLegacy.status, 201, await safeLegacy.clone().text());
    // Public compatibility aliases must obey exactly the existing subscription restrictions.
    await prisma.assinaturaSaas.create({ data: { barbeariaId: a.id, plano: 'PRO', periodicidade: 'MENSAL', status: 'CONSULTA_EXPORTACAO', precoCicloCentavos: 100, cicloInicio: new Date('2020-01-01'), cicloFim: new Date('2099-12-31') } });
    assert.equal((await request('/publico/agendamentos', 'POST', 'cliente', { barbeariaId: a.id, barbeiroId: b1.id, servicoId: s1.id, dataHora: horario('15:00') })).status, 403);
    assert.equal(await prisma.agendamento.count({ where: { barbeiroId: b3.id } }), 1);
    assert.ok(await prisma.bloqueioAgenda.findUnique({ where: { id: block.id } }));
    assert.equal((await prisma.usuario.findUniqueOrThrow({ where: { id: b1.user.id } })).papel, 'BARBEIRO');
    console.log('PASS PostgreSQL HTTP: anonymous aliases, phone history, cookie-authenticated cross-tenant/colleague probes, correct legacy slug, legitimate customer bookings and subscription-write denial');
  } finally {
    if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
