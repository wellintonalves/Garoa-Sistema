import assert from 'node:assert/strict';
import { Prisma, type Cliente, type Usuario } from '@prisma/client';
import type { Response } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthRequest } from '../src/types';

// Serviços/controlador reais com persistência em memória. Sem PostgreSQL,
// provedores, credenciais reais ou verificação de concorrência do banco.
process.env.JWT_SECRET = 'teste-cadastro-admin-segredo-sintetico';
process.env.JWT_SECRET_CLIENTE = 'teste-cadastro-cliente-segredo-sintetico';
process.env.JWT_SECRET_BARBEIRO = 'teste-cadastro-barbeiro-segredo-sintetico';

type Loja = { id: string; slug: string; nome: string; ativo: boolean };
type Conexao = { id: string; clienteId: string; barbeariaId: string; ativo: boolean };
let usuarios: Usuario[] = [];
let clientes: Cliente[] = [];
let lojas: Loja[] = [];
let conexoes: Conexao[] = [];
let historico: { clienteId: string; tipo: string; valor: number }[] = [];
let sequencia = 0;
let profundidadeTransacao = 0;
let exigirTransacao = false;
let falharUsuario = false;
let transacoes = 0;
const escritas: string[] = [];
let exclusoes = 0;

function registrarEscrita(operacao: string) {
  escritas.push(operacao);
  if (exigirTransacao) assert.equal(profundidadeTransacao, 1, `${operacao} precisa ser transacional`);
}

function usuarioFixture(dados: Partial<Usuario> = {}): Usuario {
  return {
    id: `usuario-${++sequencia}`, nome: 'Cliente sintético', email: `fixture-${sequencia}@example.test`,
    senha: 'hash-sintetico', papel: 'CLIENTE', barbeariaId: null,
    emailVerificado: false, codigoVerificacao: null, codigoExpiracao: null,
    aceiteDocumentosEm: null, termosUsoVersao: null, privacidadeVersao: null,
    aceiteDocumentosOrigem: null, createdAt: new Date('2020-01-01T12:00:00Z'), ...dados,
  };
}

function clienteFixture(usuario: Usuario): Cliente {
  return {
    id: `cliente-${++sequencia}`, usuarioId: usuario.id, barbeariaId: usuario.barbeariaId,
    telefone: '11900000000', dataNascimento: new Date('1990-01-01T12:00:00Z'),
    observacoes: 'Histórico preservado', codigoIndicacao: null,
  };
}

const fake = {
  usuario: {
    create: async ({ data }: { data: Partial<Usuario> }) => {
      registrarEscrita('usuario.create');
      if (falharUsuario) throw new Error('Falha simulada ao criar proprietário');
      const usuario = usuarioFixture({ ...data, createdAt: new Date() });
      usuarios.push(usuario);
      return usuario;
    },
    findFirst: async ({ where }: { where: Pick<Usuario, 'email' | 'barbeariaId' | 'papel'> }) => {
      const usuario = usuarios.find(u => u.email === where.email && u.barbeariaId === where.barbeariaId && u.papel === where.papel);
      return usuario ? { ...usuario, cliente: clientes.find(c => c.usuarioId === usuario.id) ?? null } : null;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<Usuario> }) => {
      registrarEscrita('usuario.update');
      const usuario = usuarios.find(u => u.id === where.id);
      assert.ok(usuario);
      Object.assign(usuario, data);
      return usuario;
    },
    deleteMany: async ({ where }: { where: { papel: string; emailVerificado: boolean; createdAt: { lt: Date } } }) => {
      registrarEscrita('usuario.deleteMany');
      exclusoes++;
      const apagados = usuarios.filter(u => u.papel === where.papel && u.emailVerificado === where.emailVerificado && u.createdAt < where.createdAt.lt);
      const ids = new Set(apagados.map(u => u.id));
      const clientesIds = new Set(clientes.filter(c => ids.has(c.usuarioId)).map(c => c.id));
      usuarios = usuarios.filter(u => !ids.has(u.id));
      clientes = clientes.filter(c => !clientesIds.has(c.id));
      conexoes = conexoes.filter(c => !clientesIds.has(c.clienteId));
      historico = historico.filter(h => !clientesIds.has(h.clienteId));
      return { count: apagados.length };
    },
  },
  barbearia: {
    create: async ({ data }: { data: Pick<Loja, 'nome' | 'slug'> }) => {
      registrarEscrita('barbearia.create');
      const loja = { ...data, id: `loja-${++sequencia}`, ativo: true };
      lojas.push(loja);
      return loja;
    },
    findFirst: async ({ where }: { where: { id: string; ativo: boolean } }) => {
      assert.equal(where.ativo, true, 'cadastro de cliente exige unidade ativa');
      return lojas.find(l => l.id === where.id && l.ativo === where.ativo) ?? null;
    },
    findUnique: async ({ where }: { where: { id?: string; slug?: string } }) =>
      lojas.find(l => where.id !== undefined ? l.id === where.id : l.slug === where.slug) ?? null,
  },
  cliente: {
    create: async ({ data }: { data: Pick<Cliente, 'usuarioId'> & Partial<Cliente> }) => {
      registrarEscrita('cliente.create');
      const usuario = usuarios.find(u => u.id === data.usuarioId);
      assert.ok(usuario);
      const cliente = { ...clienteFixture(usuario), ...data };
      clientes.push(cliente);
      return cliente;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<Cliente> }) => {
      registrarEscrita('cliente.update');
      const cliente = clientes.find(c => c.id === where.id);
      assert.ok(cliente);
      Object.assign(cliente, data);
      return cliente;
    },
  },
  clienteBarbearia: {
    findUnique: async ({ where }: { where: { clienteId_barbeariaId: Pick<Conexao, 'clienteId' | 'barbeariaId'> } }) => {
      const chave = where.clienteId_barbeariaId;
      return conexoes.find(c => c.clienteId === chave.clienteId && c.barbeariaId === chave.barbeariaId) ?? null;
    },
    create: async ({ data }: { data: Pick<Conexao, 'clienteId' | 'barbeariaId'> }) => {
      registrarEscrita('clienteBarbearia.create');
      const conexao = { ...data, id: `conexao-${++sequencia}`, ativo: true };
      conexoes.push(conexao);
      return conexao;
    },
  },
  assinaturaSaas: { findUnique: async () => null },
  configuracaoFidelidade: { findUnique: async () => null },
  $queryRaw: async (sql: Prisma.Sql) => {
    assert.equal(profundidadeTransacao, 1, 'duplicidade consultada dentro da transação');
    // O fake valida a forma da consulta; não interpreta SQL arbitrário nem simula concorrência.
    assert.match(sql.sql.replace(/\s+/g, ' '), /WHERE lower\(btrim\(email\)\) = \? AND \(\(papel = 'ADMIN' AND \? = 'ADMIN'\) OR "barbeariaId" = \?\) LIMIT 1/);
    assert.equal(sql.values.length, 3);
    const [email, papel, barbeariaId] = sql.values;
    return usuarios.filter(u => u.email.trim().toLowerCase() === email
      && ((u.papel === 'ADMIN' && papel === 'ADMIN') || (barbeariaId != null && u.barbeariaId === barbeariaId))).slice(0, 1);
  },
  $transaction: async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, options: { isolationLevel: string }): Promise<T> => {
    assert.equal(options.isolationLevel, 'Serializable');
    transacoes++;
    const antes = structuredClone({ usuarios, clientes, lojas, conexoes, historico });
    profundidadeTransacao++;
    try { return await fn(fake as unknown as Prisma.TransactionClient); }
    catch (erro) { ({ usuarios, clientes, lojas, conexoes, historico } = antes); throw erro; }
    finally { profundidadeTransacao--; }
  },
};
(globalThis as typeof globalThis & { prisma?: unknown }).prisma = { $extends: () => fake };

const aceiteDocumentos = { aceito: true, termosVersao: '2026-09-15', privacidadeVersao: '2026-09-15' };
const dados = { nome: 'Pessoa Sintética', email: ' Pessoa@example.test ', senha: 'senha-sintetica', aceiteDocumentos };

function zerar() {
  usuarios = []; clientes = []; lojas = []; conexoes = []; historico = [];
  transacoes = 0; escritas.length = 0; exclusoes = 0; falharUsuario = false; exigirTransacao = false;
}

function criarLojas() {
  lojas.push(
    { id: 'tenant-a', slug: 'unidade-a', nome: 'Unidade A', ativo: true },
    { id: 'tenant-b', slug: 'unidade-b', nome: 'Unidade B', ativo: true },
    { id: 'tenant-inativa', slug: 'unidade-inativa', nome: 'Unidade inativa', ativo: false },
  );
}

async function main() {
  const { AuthService } = await import('../src/services/auth.service');
  const { ClienteAppService } = await import('../src/services/clienteApp.service');
  const { TenantController } = await import('../src/controllers/tenantController');

  zerar(); criarLojas(); exigirTransacao = true;
  for (const papel of ['CLIENTE', 'BARBEIRO', 'SUPERADMIN', 'admin', '', null, {}, ['ADMIN']]) {
    await assert.rejects(AuthService.registrar({ ...dados, papel } as Parameters<typeof AuthService.registrar>[0]), { status: 400 });
  }
  for (const barbeariaId of ['tenant-a', '', null, 42]) {
    await assert.rejects(AuthService.registrar({ ...dados, papel: 'ADMIN', barbeariaId } as Parameters<typeof AuthService.registrar>[0]), { status: 400 });
  }
  assert.equal(transacoes, 0, 'papel/unidade injetados são rejeitados antes de iniciar cadastro');
  assert.deepEqual(escritas, [], 'ataques não podem persistir dados');

  const dono = await AuthService.registrar(dados);
  assert.equal(dono.usuario.papel, 'ADMIN', 'papel omitido cria somente proprietário');
  assert.equal(dono.usuario.email, 'pessoa@example.test');
  assert.ok(dono.usuario.barbeariaId);
  assert.notEqual(dono.usuario.barbeariaId, 'tenant-a');
  assert.equal(usuarios[0].aceiteDocumentosOrigem, 'CADASTRO_ADMIN');
  assert.equal(lojas.length, 4);
  assert.equal(transacoes, 1);
  assert.deepEqual(escritas, ['barbearia.create', 'usuario.create']);
  const tokenDono = jwt.verify(dono.token, process.env.JWT_SECRET!) as jwt.JwtPayload;
  assert.equal(tokenDono.papel, 'ADMIN');
  assert.equal(tokenDono.barbeariaId, dono.usuario.barbeariaId);
  await assert.rejects(AuthService.registrar({ ...dados, papel: 'ADMIN' }), { status: 409 });
  assert.equal(lojas.length, 4, 'duplicidade não cria barbearia órfã');
  const segundoDono = await AuthService.registrar({ ...dados, email: 'outro@example.test', papel: 'ADMIN' });
  assert.equal(segundoDono.usuario.papel, 'ADMIN', 'compatibilidade ADMIN explícito');
  assert.notEqual(segundoDono.usuario.barbeariaId, dono.usuario.barbeariaId);

  const antesFalha = structuredClone({ usuarios, lojas });
  falharUsuario = true;
  await assert.rejects(AuthService.registrar({ ...dados, email: 'falha@example.test' }), /Falha simulada/);
  falharUsuario = false;
  assert.deepEqual({ usuarios, lojas }, antesFalha, 'falha de usuário reverte também a nova unidade no fake transacional');
  console.log('PASS: cadastro público rejeita injeção de papel/unidade; cria somente ADMIN em nova unidade e solicita transação serializável com rollback simulado.');

  const antesCliente = escritas.length;
  for (const aceiteDocumentos of [undefined, false, { aceito: false }, { ...dados.aceiteDocumentos, termosVersao: 'antiga' }]) {
    await assert.rejects(AuthService.registrarCliente({ ...dados, aceiteDocumentos, barbeariaId: 'tenant-a' }), /Leia e aceite/);
  }
  for (const papel of ['ADMIN', 'BARBEIRO', 'SUPERADMIN', '', null]) {
    await assert.rejects(AuthService.registrarCliente({ ...dados, barbeariaId: 'tenant-a', papel } as Parameters<typeof AuthService.registrarCliente>[0]), { status: 400 });
  }
  for (const barbeariaId of [undefined, '', null]) {
    await assert.rejects(AuthService.registrarCliente({ ...dados, barbeariaId } as Parameters<typeof AuthService.registrarCliente>[0]), { status: 400 });
  }
  for (const barbeariaId of ['tenant-inativa', 'tenant-ausente']) {
    await assert.rejects(AuthService.registrarCliente({ ...dados, barbeariaId }), { status: 404 });
  }
  assert.equal(escritas.length, antesCliente, 'cadastro inválido/inativo não grava');
  const totalLojas = lojas.length;
  const clienteA = await AuthService.registrarCliente({ ...dados, barbeariaId: 'tenant-a' });
  assert.equal(clienteA.usuario.papel, 'CLIENTE');
  assert.equal(clienteA.usuario.barbeariaId, 'tenant-a');
  const tokenCliente = jwt.verify(clienteA.token, process.env.JWT_SECRET!) as jwt.JwtPayload;
  assert.equal(tokenCliente.papel, 'CLIENTE');
  assert.equal(tokenCliente.barbeariaId, 'tenant-a');
  assert.equal(usuarios.find(u => u.id === clienteA.usuario.id)!.aceiteDocumentosOrigem, 'CADASTRO_TENANT');
  const clienteB = await AuthService.registrarCliente({ ...dados, papel: 'CLIENTE', barbeariaId: 'tenant-b' });
  assert.equal(clienteB.usuario.papel, 'CLIENTE');
  assert.notEqual(clienteA.usuario.id, clienteB.usuario.id, 'mesmo email continua permitido em unidades distintas');
  await assert.rejects(AuthService.registrarCliente({ ...dados, papel: 'CLIENTE', barbeariaId: 'tenant-a' }), { status: 409 });
  assert.equal(lojas.length, totalLojas, 'cadastro de cliente não cria unidade');
  console.log('PASS: cadastro tenant fixa CLIENTE, exige unidade ativa e mantém duplicidade isolada por unidade.');

  exigirTransacao = false; // O controlador ainda cria o perfil de cliente após o serviço.
  let status = 200;
  let corpo: unknown;
  const resposta = {
    status(codigo: number) { status = codigo; return this; },
    json(valor: unknown) { corpo = valor; return this; },
  } as unknown as Response;
  await TenantController.registerClient({
    params: { slug: 'unidade-a' },
    body: { ...dados, email: 'cliente-rota@example.test', papel: 'ADMIN', barbeariaId: 'tenant-b', telefone: '11999999999' },
  } as unknown as AuthRequest, resposta);
  assert.equal(status, 201, JSON.stringify(corpo));
  const criadoPelaRota = usuarios.find(u => u.email === 'cliente-rota@example.test');
  assert.equal(criadoPelaRota?.papel, 'CLIENTE');
  assert.equal(criadoPelaRota?.barbeariaId, 'tenant-a', 'unidade vem do slug, não do body');
  assert.equal(clientes.find(c => c.usuarioId === criadoPelaRota?.id)?.barbeariaId, 'tenant-a');
  console.log('PASS: controlador tenant ignora papel/unidade forjados e mantém perfil na unidade da URL.');

  zerar(); criarLojas();
  for (const barbeariaId of ['tenant-a', 'tenant-b', null]) {
    const usuario = usuarioFixture({ barbeariaId });
    const cliente = clienteFixture(usuario);
    usuarios.push(usuario); clientes.push(cliente);
    conexoes.push({ id: `historica-${cliente.id}`, clienteId: cliente.id, barbeariaId: barbeariaId ?? 'tenant-a', ativo: true });
    historico.push({ clienteId: cliente.id, tipo: 'agendamento', valor: 50 }, { clienteId: cliente.id, tipo: 'fidelidade', valor: 10 });
  }
  const preservados = structuredClone({ usuarios, clientes, conexoes, historico });
  const idsUsuarios = new Set(usuarios.map(u => u.id));
  const idsClientes = new Set(clientes.map(c => c.id));
  function verificarPreservacao() {
    assert.equal(exclusoes, 0, 'cadastro nunca executa limpeza global de usuários');
    assert.deepEqual(usuarios.filter(u => idsUsuarios.has(u.id)), preservados.usuarios);
    assert.deepEqual(clientes.filter(c => idsClientes.has(c.id)), preservados.clientes);
    assert.deepEqual(conexoes.filter(c => idsClientes.has(c.clienteId)), preservados.conexoes);
    assert.deepEqual(historico, preservados.historico);
  }
  const cadastro = { ...dados, email: ' Nova@example.test ', dataNascimento: '1990-01-01', telefone: '11988888888', barbeariaId: 'tenant-a' };
  const novo = await ClienteAppService.registrar({ ...cadastro });
  assert.equal(novo.isNovo, true);
  const usuarioGlobal = usuarios.find(u => u.id === novo.cliente.usuarioId)!;
  assert.equal(usuarioGlobal.email, 'nova@example.test');
  assert.equal(usuarioGlobal.papel, 'CLIENTE');
  assert.equal(usuarioGlobal.barbeariaId, null);
  assert.equal(usuarioGlobal.aceiteDocumentosOrigem, 'CADASTRO_CLIENTE');
  assert.ok(conexoes.some(c => c.clienteId === novo.cliente.clienteId && c.barbeariaId === 'tenant-a'), 'convite continua conectando cliente');
  assert.ok(jwt.verify(novo.token, process.env.JWT_SECRET_CLIENTE!));
  verificarPreservacao();

  // Repetir um cadastro pendente antigo atualiza só aquela conta, preservando ID/histórico.
  usuarioGlobal.createdAt = new Date('2020-01-01T12:00:00Z');
  historico.push({ clienteId: novo.cliente.clienteId, tipo: 'agendamento', valor: 75 });
  preservados.historico.push({ clienteId: novo.cliente.clienteId, tipo: 'agendamento', valor: 75 });
  const repetido = await ClienteAppService.registrar({ ...cadastro, nome: 'Nome atualizado', barbeariaId: 'tenant-b' });
  assert.equal(repetido.isNovo, false);
  assert.equal(repetido.cliente.usuarioId, novo.cliente.usuarioId);
  assert.equal(repetido.cliente.clienteId, novo.cliente.clienteId);
  assert.equal(usuarios.find(u => u.id === novo.cliente.usuarioId)?.nome, 'Nome atualizado');
  assert.ok(conexoes.some(c => c.clienteId === novo.cliente.clienteId && c.barbeariaId === 'tenant-b'));
  assert.equal(usuarios.length, preservados.usuarios.length + 1, 'repetição não recria conta');
  verificarPreservacao();

  usuarios.find(u => u.id === novo.cliente.usuarioId)!.emailVerificado = true;
  const antesDuplicidade = structuredClone({ usuarios, clientes, conexoes, historico });
  await assert.rejects(ClienteAppService.registrar({ ...cadastro }), /já está cadastrado/);
  assert.deepEqual({ usuarios, clientes, conexoes, historico }, antesDuplicidade, 'duplicidade verificada não altera nenhuma conta ou histórico');
  verificarPreservacao();
  console.log('PASS: signup global novo, repetido e duplicado não apaga clientes antigos de outras unidades; identidade, histórico e convite preservados em memória.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
