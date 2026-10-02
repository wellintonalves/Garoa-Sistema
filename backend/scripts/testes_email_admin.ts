import assert from 'node:assert/strict';
import { Prisma, type Usuario } from '@prisma/client';

// Serviço real, persistência controlada. Não testa concorrência PostgreSQL.
process.env.JWT_SECRET = 'teste-email-admin-segredo-sintetico';
process.env.JWT_SECRET_CLIENTE = 'teste-email-cliente-segredo-sintetico';
process.env.JWT_SECRET_BARBEIRO = 'teste-email-barbeiro-segredo-sintetico';
let usuarios: Usuario[] = [];
let lojas = 0;
let falharCriacao = false;
const fake = {
  usuario: {
    findMany: async ({ where }: { where: { email: { equals: string }; papel?: string; barbeariaId?: string } }) =>
      usuarios.filter(u => u.email.toLowerCase() === where.email.equals
        && (!where.papel || u.papel === where.papel)
        && (!where.barbeariaId || u.barbeariaId === where.barbeariaId)),
    create: async ({ data }: { data: Omit<Usuario, 'id' | 'createdAt' | 'emailVerificado' | 'codigoVerificacao' | 'codigoExpiracao'> }) => {
      if (falharCriacao) throw new Error('Falha simulada');
      const u: Usuario = { ...data, id: String(usuarios.length + 1), createdAt: new Date(), emailVerificado: false, codigoVerificacao: null, codigoExpiracao: null };
      usuarios.push(u);
      return u;
    },
  },
  barbearia: {
    create: async () => ({ id: `loja-${++lojas}` }),
    findFirst: async ({ where }: { where: { id: string; ativo: boolean } }) => {
      assert.equal(where.ativo, true);
      return ['cliente-a', 'cliente-b'].includes(where.id) ? { id: where.id } : null;
    },
  },
  $queryRaw: async (sql: Prisma.Sql) => {
    const [email, papel, barbeariaId] = sql.values;
    return usuarios.filter(u => u.email.trim().toLowerCase() === email
      && ((u.papel === 'ADMIN' && papel === 'ADMIN') || (barbeariaId != null && u.barbeariaId === barbeariaId))).slice(0, 1);
  },
  $transaction: async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, options: { isolationLevel: string }): Promise<T> => {
    assert.equal(options.isolationLevel, 'Serializable');
    const antes = [...usuarios];
    const lojasAntes = lojas;
    try { return await fn(fake as unknown as Prisma.TransactionClient); }
    catch (e) { usuarios = antes; lojas = lojasAntes; throw e; }
  },
};
(globalThis as typeof globalThis & { prisma?: unknown }).prisma = { $extends: () => fake };

async function main() {
  const { AuthService } = await import('../src/services/auth.service');
  const { ClienteAppService } = await import('../src/services/clienteApp.service');
  const dados = { nome: 'Teste', email: ' Admin@example.test ', senha: 'teste-seguro', papel: 'ADMIN' as const, aceiteDocumentos: { aceito: true, termosVersao: '2026-09-15', privacidadeVersao: '2026-09-15' } };
  for (const aceiteDocumentos of [undefined, false, { aceito: false }, { ...dados.aceiteDocumentos, aceito: 'true' }, { ...dados.aceiteDocumentos, termosVersao: 'antiga' }, { ...dados.aceiteDocumentos, privacidadeVersao: 'antiga' }]) {
    await assert.rejects(AuthService.registrar({ ...dados, aceiteDocumentos }), /Leia e aceite/);
    await assert.rejects(ClienteAppService.registrar({ ...dados, dataNascimento: '1990-01-01', aceiteDocumentos }), /Leia e aceite/);
    assert.equal(usuarios.length, 0, 'sem aceite não persiste usuário');
    assert.equal(lojas, 0, 'sem aceite não persiste barbearia');
  }
  const antesAceite = Date.now();
  const primeiro = await AuthService.registrar(dados);
  assert.equal(usuarios[0].termosUsoVersao, '2026-09-15');
  assert.equal(usuarios[0].privacidadeVersao, '2026-09-15');
  assert.equal(usuarios[0].aceiteDocumentosOrigem, 'CADASTRO_ADMIN');
  assert.ok(usuarios[0].aceiteDocumentosEm!.getTime() >= antesAceite);
  // Representa cadastro anterior à coleta: login não inventa nem exige aceite.
  usuarios[0].aceiteDocumentosEm = null;
  usuarios[0].termosUsoVersao = null;
  usuarios[0].privacidadeVersao = null;
  usuarios[0].aceiteDocumentosOrigem = null;
  assert.equal(primeiro.usuario.email, 'admin@example.test');
  assert.equal(lojas, 1);
  await assert.rejects(AuthService.registrar({ ...dados, barbeariaId: 'outra' }), { status: 400 });
  await assert.rejects(AuthService.registrar(dados), /já está cadastrado/);
  assert.equal(lojas, 1, 'duplicidade não cria barbearia órfã');
  await AuthService.registrarCliente({ ...dados, papel: 'CLIENTE', barbeariaId: 'cliente-a' });
  await AuthService.registrarCliente({ ...dados, papel: 'CLIENTE', barbeariaId: 'cliente-b' });
  await assert.rejects(AuthService.registrarCliente({ ...dados, papel: 'CLIENTE', barbeariaId: 'cliente-b' }), { status: 409 });
  // Equipe é uma fixture pré-existente: o cadastro público não cria barbeiros.
  for (const barbeariaId of ['barbeiro-a', 'barbeiro-b']) {
    usuarios.push({ ...usuarios[0], id: `equipe-${barbeariaId}`, papel: 'BARBEIRO', barbeariaId });
  }
  assert.equal((await AuthService.login({ ...dados, email: 'admin@example.test' })).usuario.id, primeiro.usuario.id);
  assert.equal((await AuthService.login({ ...dados, papel: 'CLIENTE', barbeariaId: 'cliente-b' })).usuario.barbeariaId, 'cliente-b');
  assert.equal((await AuthService.login({ ...dados, papel: 'BARBEIRO', barbeariaId: 'barbeiro-b' })).usuario.barbeariaId, 'barbeiro-b');
  assert.equal(usuarios[0].aceiteDocumentosEm, null, 'login legado não fabrica aceite');
  falharCriacao = true;
  await assert.rejects(AuthService.registrar({ ...dados, email: 'novo@example.test' }), /Falha simulada/);
  assert.equal(lojas, 1, 'erro ao criar usuário reverte barbearia');
  falharCriacao = false;
  await assert.rejects(AuthService.login({ ...dados, senha: 'invalida' }), /Email ou senha incorretos/);
  console.log('PASS: email ADMIN exclusivo, normalização, clientes multiunidade, equipe pré-existente, rollback e login preservado (persistência simulada).');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
