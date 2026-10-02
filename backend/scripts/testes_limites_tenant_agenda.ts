import assert from 'node:assert/strict';
import express, { type Response } from 'express';
import type { AddressInfo } from 'node:net';
import type { AtorAgenda } from '../src/services/acessoAgenda.service';

// Synthetic in-memory delegates deliberately do NOT inject tenant filters. Every
// predicate asserted below must be supplied by the real service/controller.
process.env.JWT_SECRET = 'teste-tenant-admin-segredo-sintetico';
process.env.JWT_SECRET_CLIENTE = 'teste-tenant-cliente-segredo-sintetico';
process.env.JWT_SECRET_BARBEIRO = 'teste-tenant-barbeiro-segredo-sintetico';
process.env.NODE_ENV = 'test';

type RecordData = Record<string, any>;
const future = '2099-10-02T14:00:00-03:00';
const lojas = [{ id: 'A', slug: 'alpha', ativo: true }, { id: 'B', slug: 'beta', ativo: true }];
const usuarios = [
  { id: 'u1', nome: 'Barbeiro um', papel: 'BARBEIRO', emailVerificado: true },
  { id: 'u2', nome: 'Barbeiro dois', papel: 'BARBEIRO', emailVerificado: true },
  { id: 'u3', nome: 'Barbeiro externo', papel: 'BARBEIRO', emailVerificado: true },
  { id: 'uc1', nome: 'Cliente fixture', papel: 'CLIENTE', emailVerificado: true },
  { id: 'uc2', nome: 'Cliente externo', papel: 'CLIENTE', emailVerificado: true },
];
const barbeiros = [
  { id: 'b1', usuarioId: 'u1', barbeariaId: 'A', ativo: true },
  { id: 'b2', usuarioId: 'u2', barbeariaId: 'A', ativo: true },
  { id: 'b3', usuarioId: 'u3', barbeariaId: 'B', ativo: true },
];
const servicos = [
  { id: 's1', barbeariaId: 'A', ativo: true, nome: 'Corte', preco: 35, duracaoMinutos: 30 },
  { id: 's2', barbeariaId: 'A', ativo: true, nome: 'Barba', preco: 20, duracaoMinutos: 20 },
  { id: 's3', barbeariaId: 'B', ativo: true, nome: 'Externo', preco: 100, duracaoMinutos: 40 },
];
const clientes = [
  { id: 'c1', usuarioId: 'uc1', barbeariaId: 'A', telefone: '11900000001', observacoes: 'NÃO DIVULGAR', dataNascimento: '1990-01-01' },
  { id: 'c2', usuarioId: 'uc2', barbeariaId: 'B', telefone: '11900000002', observacoes: 'NÃO DIVULGAR', dataNascimento: '1990-01-02' },
];
const conexoes: RecordData[] = [];
const agendamentos: RecordData[] = [
  { id: 'ag1', barbeariaId: 'A', clienteId: 'c1', barbeiroId: 'b1', servicoId: 's1', servicosIds: ['s1'], status: 'AGUARDANDO', dataHora: new Date(future), itens: [] },
  { id: 'ag2', barbeariaId: 'A', clienteId: 'c1', barbeiroId: 'b2', servicoId: 's1', servicosIds: ['s1'], status: 'AGUARDANDO', dataHora: new Date(future), itens: [] },
  { id: 'ag3', barbeariaId: 'B', clienteId: 'c2', barbeiroId: 'b3', servicoId: 's3', servicosIds: ['s3'], status: 'AGUARDANDO', dataHora: new Date(future), itens: [] },
];
const bloqueios: RecordData[] = [
  { id: 'bl1', barbeiroId: 'b1', dataInicio: new Date(future), dataFim: new Date('2099-10-02T19:00:00Z'), motivo: 'Privado A' },
  { id: 'bl2', barbeiroId: 'b2', dataInicio: new Date(future), dataFim: new Date('2099-10-02T19:00:00Z'), motivo: 'Privado colega' },
  { id: 'bl3', barbeiroId: 'b3', dataInicio: new Date(future), dataFim: new Date('2099-10-02T19:00:00Z'), motivo: 'Privado B' },
];
const admin: AtorAgenda = { id: 'adminA', papel: 'ADMIN', barbeariaId: 'A' };
const barber: AtorAgenda = { id: 'u1', papel: 'BARBEIRO', barbeariaId: 'A' };
const writes: RecordData[] = [];
const reads: RecordData[] = [];

function materialize(row: RecordData): RecordData {
  return { ...row,
    ...(row.usuarioId ? { usuario: usuarios.find(u => u.id === row.usuarioId) } : {}),
    ...(row.barbeariaId ? { barbearia: lojas.find(l => l.id === row.barbeariaId) } : {}),
    ...(row.barbeiroId ? { barbeiro: materialize(barbeiros.find(b => b.id === row.barbeiroId)!) } : {}),
    ...(row.clienteId ? { cliente: materialize(clientes.find(c => c.id === row.clienteId)!) } : {}),
    ...(row.servicoId ? { servico: servicos.find(s => s.id === row.servicoId) } : {}),
    ...(row.id.startsWith('c') ? { clientesBarbearias: conexoes.filter(c => c.clienteId === row.id) } : {}),
  };
}
function matches(row: RecordData, where: RecordData = {}): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (expected === undefined) return true;
    if (key === 'OR') return expected.some((predicate: RecordData) => matches(row, predicate));
    if (key === 'NOT') return !matches(row, expected);
    const actual = row[key];
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('in' in expected) return expected.in.includes(actual);
      if ('not' in expected) return actual !== expected.not;
      if ('notIn' in expected) return !expected.notIn.includes(actual);
      if ('some' in expected) return Array.isArray(actual) && actual.some(child => matches(child, expected.some));
      if ('lt' in expected || 'gt' in expected || 'gte' in expected || 'lte' in expected) {
        return (!('lt' in expected) || actual < expected.lt) && (!('gt' in expected) || actual > expected.gt)
          && (!('gte' in expected) || actual >= expected.gte) && (!('lte' in expected) || actual <= expected.lte);
      }
      return !!actual && matches(actual, expected);
    }
    return actual === expected;
  });
}
function delegate(name: string, rows: RecordData[]) {
  const find = (where: RecordData) => rows.find(row => matches(materialize(row), where));
  return {
    findFirst: async ({ where }: RecordData) => { reads.push({ name, where }); const row = find(where); return row ? materialize(row) : null; },
    findUnique: async ({ where }: RecordData) => { reads.push({ name, where }); const row = find(where); return row ? materialize(row) : null; },
    findMany: async ({ where }: RecordData = {}) => { reads.push({ name, where }); return rows.filter(row => matches(materialize(row), where)).map(materialize); },
    update: async ({ where, data }: RecordData) => {
      writes.push({ name, where, data });
      const row = find(where); assert.ok(row, `${name}.update must be authorized`);
      for (const [key, value] of Object.entries(data)) if (value !== undefined) row[key] = value;
      return materialize(row);
    },
    updateMany: async ({ where, data }: RecordData) => {
      writes.push({ name, where, data });
      const found = rows.filter(row => matches(materialize(row), where));
      for (const row of found) Object.assign(row, data);
      return { count: found.length };
    },
    create: async ({ data }: RecordData) => {
      writes.push({ name, data }); const row = { id: `new-${rows.length}`, ...data }; rows.push(row); return materialize(row);
    },
    deleteMany: async ({ where }: RecordData) => {
      const found = rows.filter(row => matches(materialize(row), where));
      if (found.length) writes.push({ name, where });
      for (const row of found) rows.splice(rows.indexOf(row), 1);
      return { count: found.length };
    },
  };
}
let assinaturaStatus = 'ATIVA';
const fake = {
  assinaturaSaas: { findUnique: async () => ({ status: assinaturaStatus, cicloFim: new Date('2099-12-31T23:00:00Z'), cicloInicio: new Date('2020-01-01') }) },
  usuario: delegate('usuario', usuarios), barbearia: delegate('barbearia', lojas),
  cliente: delegate('cliente', clientes), barbeiro: delegate('barbeiro', barbeiros),
  servico: delegate('servico', servicos), agendamento: delegate('agendamento', agendamentos),
  bloqueioAgenda: delegate('bloqueio', bloqueios),
  clienteBarbearia: { findUnique: async ({ where }: RecordData) => conexoes.find(c => matches(c, where.clienteId_barbeariaId)) ?? null },
  configuracao: delegate('configuracao', [{ id: 'configA', barbeariaId: 'A', horariosFuncionamento: { segunda: { fechado: true } } }]),
  historicoRemarcacao: { create: async ({ data }: RecordData) => { writes.push({ name: 'historico', data }); return data; } },
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(fake),
};
(globalThis as typeof globalThis & { prisma?: unknown }).prisma = { $extends: () => fake };

async function rejectedWithoutWrites(fn: () => Promise<unknown>) {
  const before = writes.length;
  await assert.rejects(fn);
  assert.equal(writes.length, before, 'forbidden request must not mutate data');
}
function response() {
  let status = 200; let body: unknown;
  const res = { status(code: number) { status = code; return this; }, json(data: unknown) { body = data; return this; } } as unknown as Response;
  return { res, get status() { return status; }, get body() { return body; } };
}
async function main() {
  const { AgendamentoService } = await import('../src/services/agendamento.service');
  const { BloqueioService } = await import('../src/services/bloqueio.service');
  const { ClienteService } = await import('../src/services/cliente.service');
  const { ServicoService } = await import('../src/services/servico.service');
  const { ConfiguracaoService } = await import('../src/services/configuracao.service');
  const { ConfiguracaoController } = await import('../src/controllers/configuracao.controller');
  const { PublicoController } = await import('../src/controllers/publico.controller');
  const { TenantController } = await import('../src/controllers/tenantController');
  const { reciboAgendamento } = await import('../src/utils/agendamentoEntrada.util');
  const { tenantStorage } = await import('../src/lib/als');
  const { validarVinculoCliente } = await import('../src/services/acessoAgenda.service');
  // Schedule validation is isolated here; real availability/financial tests remain separate.
  let validatedDuration = 0;
  AgendamentoService.validarAgendamento = async (_shop, _barber, _customer, _date, duration) => { validatedDuration = duration; };

  for (const key of ['barbeiro', 'cliente', 'barbearia', 'itens', 'historicoRemarcacoes', 'lancamentos', 'id', 'barbeariaId', 'clienteId', 'valorCobrado', 'valorBruto', 'valorLiquido', 'origem']) {
    await rejectedWithoutWrites(() => AgendamentoService.atualizar('ag1', { [key]: { update: { usuario: { update: { papel: 'ADMIN' } } } } }, barber));
  }
  for (const operator of ['update', 'connect', 'delete', 'upsert', 'set', 'disconnect', 'create', 'deleteMany']) {
    await rejectedWithoutWrites(() => AgendamentoService.atualizar('ag1', { barbeiro: { [operator]: { id: 'b3' } } }, barber));
    await rejectedWithoutWrites(() => ClienteService.atualizar('c1', { usuario: { [operator]: { papel: 'ADMIN' } } } as never, 'A'));
  }
  for (const payload of [{ status: { set: 'CONCLUIDO' } }, { servicosIds: { set: ['s3'] } }, { observacoes: { set: 'canary' } }, { pontosUsados: -1 }, { descontoReais: Infinity }]) {
    await rejectedWithoutWrites(() => AgendamentoService.atualizar('ag1', payload, barber));
  }
  await rejectedWithoutWrites(() => ClienteService.atualizar('c1', { telefone: { set: 'changed' } } as never, 'A'));
  await rejectedWithoutWrites(() => ServicoService.atualizar('s1', { barbearia: { update: { usuarios: { updateMany: {} } } } } as never));
  await rejectedWithoutWrites(() => ServicoService.atualizar('s1', { preco: { increment: 1 } } as never));
  await rejectedWithoutWrites(() => ConfiguracaoService.atualizar({ barbearia: { update: { ativo: false } } }, 'A'));
  await rejectedWithoutWrites(() => ConfiguracaoService.atualizar({ horariosFuncionamento: { segunda: { update: {} } } }, 'A'));
  await rejectedWithoutWrites(() => ConfiguracaoService.atualizar({ baseCalculoComissao: { set: 'VALOR_BRUTO' } }, 'A'));
  for (const handler of [ConfiguracaoController.getMinhaBarbearia, ConfiguracaoController.updateMinhaBarbearia]) {
    const before = writes.length; const output = response();
    await handler({ usuario: { ...admin, barbeariaId: null }, body: {} } as never, output.res);
    assert.equal(output.status, 403); assert.equal(writes.length, before);
  }
  for (const body of [{ nome: { set: 'canary' } }, { temAlmoco: { set: true } }, { usuarios: { deleteMany: {} } }, { id: 'B' }, { ativo: false }]) {
    const before = writes.length; const output = response();
    await ConfiguracaoController.updateMinhaBarbearia({ usuario: admin, body } as never, output.res);
    assert.equal(output.status, 400); assert.equal(writes.length, before);
  }
  console.log('PASS VLB-04: nested writes, unknown/immutable fields and scalar ORM operators rejected before writes');

  await rejectedWithoutWrites(() => AgendamentoService.buscarPorId('ag2', barber));
  await rejectedWithoutWrites(() => AgendamentoService.buscarPorId('ag3', admin));
  await rejectedWithoutWrites(() => AgendamentoService.horariosDisponivies('b3', '2099-10-02', admin));
  await rejectedWithoutWrites(() => AgendamentoService.horariosDisponivies('b2', '2099-10-02', barber));
  for (const status of ['CANCELADO', 'CONCLUIDO', 'CONFIRMADO']) await rejectedWithoutWrites(() => AgendamentoService.atualizar('ag2', { status }, barber));
  await rejectedWithoutWrites(() => AgendamentoService.simularDesconto('ag2', barber, 'NENHUM'));
  await rejectedWithoutWrites(() => AgendamentoService.cancelar('ag2', barber));
  await rejectedWithoutWrites(() => AgendamentoService.atualizar('ag1', { barbeiroId: 'b2' }, barber));
  await rejectedWithoutWrites(() => AgendamentoService.listarTodos({}, { ...barber, id: 'missing' }));
  await rejectedWithoutWrites(() => AgendamentoService.listarTodos({}, undefined as never));
  await AgendamentoService.atualizar('ag1', { status: 'CONFIRMADO', observacoes: 'válido' }, barber);
  assert.equal(agendamentos[0].status, 'CONFIRMADO');
  await AgendamentoService.atualizar('ag2', { status: 'CONFIRMADO' }, admin);
  assert.equal(agendamentos[1].status, 'CONFIRMADO');
  console.log('PASS VLB-10: colleague read/close/cancel/preview/reassignment blocked; owner and tenant admin updates preserved');

  assert.deepEqual(await BloqueioService.listar({ barbeiroId: 'b3' }, admin), []);
  assert.equal((await BloqueioService.listar({}, barber)).length, 1);
  await rejectedWithoutWrites(() => BloqueioService.criar('b3', future, '2099-10-02T20:00:00Z', '', admin));
  await rejectedWithoutWrites(() => BloqueioService.criar('b2', future, '2099-10-02T20:00:00Z', '', barber));
  await rejectedWithoutWrites(() => BloqueioService.remover('bl3', admin));
  await rejectedWithoutWrites(() => BloqueioService.remover('bl2', barber));
  await rejectedWithoutWrites(() => BloqueioService.listar({}, { ...barber, id: 'missing' }));
  await BloqueioService.criar('b2', '2099-10-03T10:00:00-03:00', '2099-10-03T11:00:00-03:00', 'novo', admin);
  await BloqueioService.remover('bl1', barber);
  assert.ok(bloqueios.some(b => b.id === 'bl3'));
  console.log('PASS VLB-05: mandatory tenant filters and block ownership; valid same-tenant administration preserved');

  const base = { barbeariaId: 'A', clienteId: 'c1', barbeiroId: 'b1', servicoId: 's1', servicosIds: ['s1'], dataHora: future };
  for (const changes of [{ barbeiroId: 'b3' }, { servicoId: 's3', servicosIds: ['s3'] }, { servicosIds: ['s1', 's3'] }, { servicosIds: ['s1', 'missing'] }, { clienteId: 'c2' }, { barbeariaId: 'B' }, { servicosIds: ['s1', 's1'] }]) {
    await rejectedWithoutWrites(() => AgendamentoService.criar({ ...base, ...changes }, admin));
  }
  await rejectedWithoutWrites(() => AgendamentoService.criar(base, undefined as never));
  await rejectedWithoutWrites(() => AgendamentoService.criar(base, { id: 'uc2', papel: 'CLIENTE', barbeariaId: 'A' }));
  await rejectedWithoutWrites(() => tenantStorage.run({ barbeariaId: 'B' }, () => AgendamentoService.criar(base, admin)));
  await rejectedWithoutWrites(() => AgendamentoService.criar({ ...base, barbeiroId: 'b2' }, barber));
  await rejectedWithoutWrites(() => AgendamentoService.atualizar('ag1', { servicosIds: ['s1', 's3'] }, admin));
  await rejectedWithoutWrites(() => AgendamentoService.atualizar('ag1', { barbeiroId: 'b3' }, admin));
  await rejectedWithoutWrites(() => AgendamentoService.atualizar('ag1', { status: 'CONCLUIDO', servicoId: 's2' }, admin));
  const created = await AgendamentoService.criar({ ...base, servicosIds: ['s1', 's2'] }, admin);
  assert.equal(validatedDuration, 50);
  assert.equal(created.valorCobrado, 55);
  const receipt = reciboAgendamento(created);
  assert.deepEqual(Object.keys(receipt).sort(), ['barbeiro', 'dataHora', 'id', 'servico', 'status']);
  for (const sensitive of ['telefone', 'dataNascimento', 'observacoes', 'usuarioId', 'email', 'senha', 'comissaoPercent']) assert.ok(!JSON.stringify(receipt).includes(sensitive));
  conexoes.push({ clienteId: 'c1', barbeariaId: 'A', ativo: false });
  await rejectedWithoutWrites(() => validarVinculoCliente('c1', 'A'));
  conexoes.length = 0;
  conexoes.push({ clienteId: 'c2', barbeariaId: 'A', ativo: true });
  await validarVinculoCliente('c2', 'A');
  conexoes.length = 0;
  console.log('PASS VLB-08: mixed/missing/inactive membership and forged identity rejected; multi-service price/duration and minimal receipts preserved');

  const next = (error?: unknown) => { if (error) throw error; };
  const readCount = reads.length;
  await assert.rejects(() => PublicoController.checarFidelidade({ query: { telefone: clientes[0].telefone } } as never, response().res, next));
  assert.equal(reads.length, readCount, 'anonymous phone lookup never even reads a profile/history');
  const identity = { clienteId: 'c1', usuarioId: 'uc1', nome: 'fixture', email: 'fixture@example.test' };
  await assert.rejects(() => PublicoController.checarFidelidade({ cliente: identity, query: { telefone: clientes[1].telefone, barbeariaId: 'A' } } as never, response().res, next));
  await assert.rejects(() => PublicoController.checarFidelidade({ cliente: identity, query: { barbeariaId: 'B' } } as never, response().res, next));
  await rejectedWithoutWrites(() => PublicoController.criarAgendamento({ cliente: identity, body: { ...base, clienteId: 'c2' } } as never, response().res, next));
  const publicResponse = response();
  await PublicoController.criarAgendamento({ cliente: identity, body: { barbeariaId: 'A', barbeiroId: 'b1', servicoId: 's1', dataHora: future } } as never, publicResponse.res, next);
  assert.equal(publicResponse.status, 201);
  assert.ok(!('cliente' in (publicResponse.body as object)));
  assinaturaStatus = 'CONSULTA_EXPORTACAO';
  await rejectedWithoutWrites(() => PublicoController.criarAgendamento({ cliente: identity, body: { barbeariaId: 'A', barbeiroId: 'b1', servicoId: 's1', dataHora: future } } as never, response().res, next));
  assinaturaStatus = 'ATIVA';
  usuarios.find(u => u.id === 'uc1')!.emailVerificado = false;
  await rejectedWithoutWrites(() => PublicoController.criarAgendamento({ cliente: identity, body: base } as never, response().res, next));
  usuarios.find(u => u.id === 'uc1')!.emailVerificado = true;
  const legacyResponse = response();
  await TenantController.agendar({ body: { clienteId: 'c2' }, params: { slug: 'alpha' } } as never, legacyResponse.res);
  assert.equal(legacyResponse.status, 401);
  const legacyMixed = response();
  await TenantController.agendar({ usuario: { id: 'uc1', papel: 'CLIENTE', barbeariaId: 'A' }, params: { slug: 'beta' }, body: {} } as never, legacyMixed.res);
  assert.equal(legacyMixed.status, 404);
  console.log('PASS VLB-07/08: phone enumeration stopped before reads; verified public identity and matching tenant required');

  // Real Express routes: unauthenticated requests cannot bypass the controllers.
  const { default: publicoRoutes } = await import('../src/routes/publico.routes');
  const { default: tenantRoutes } = await import('../src/routes/tenantRoutes');
  const { errorMiddleware } = await import('../src/middlewares/error.middleware');
  const app = express(); app.use(express.json()); app.use('/publico', publicoRoutes); app.use('/b', tenantRoutes); app.use(errorMiddleware);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>(resolve => server.once('listening', resolve));
    const port = (server.address() as AddressInfo).port;
    for (const [path, method] of [['/publico/agendamentos', 'POST'], ['/publico/fidelidade?telefone=11900000001', 'GET'], ['/b/alpha/agendar', 'POST'], ['/b/alpha/app/agendar', 'POST']]) {
      const before = writes.length;
      const result = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers: { 'X-Valen-Client': 'web', 'Origin': 'http://localhost:5173', 'content-type': 'application/json' }, ...(method === 'POST' ? { body: JSON.stringify({ clienteId: 'c1' }) } : {}) });
      assert.equal(result.status, 401, `${method} ${path}`);
      assert.equal(writes.length, before);
    }
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  console.log('PASS HTTP: all anonymous booking aliases and phone-only loyalty return 401 without mutations');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
