import assert from 'node:assert/strict';
import { Prisma, type Usuario } from '@prisma/client';

// Serviço real, persistência controlada. Não testa concorrência PostgreSQL.
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
  barbearia: { create: async () => ({ id: `loja-${++lojas}` }) },
  $queryRaw: async (sql: Prisma.Sql) => {
    const [email, papel, barbeariaId] = sql.values;
    return usuarios.filter(u => u.email.trim().toLowerCase() === email
      && ((u.papel === 'ADMIN' && papel === 'ADMIN') || (barbeariaId != null && u.barbeariaId === barbeariaId))).slice(0, 1);
  },
  $transaction: async <T>(fn: (tx: typeof fake) => Promise<T>, options: { isolationLevel: string }): Promise<T> => {
    assert.equal(options.isolationLevel, 'Serializable');
    const antes = [...usuarios];
    const lojasAntes = lojas;
    try { return await fn(fake); }
    catch (e) { usuarios = antes; lojas = lojasAntes; throw e; }
  },
};
(globalThis as typeof globalThis & { prisma?: unknown }).prisma = { $extends: () => fake };

async function main() {
  const { AuthService } = await import('../src/services/auth.service');
  const dados = { nome: 'Teste', email: ' Admin@example.test ', senha: 'teste-seguro', papel: 'ADMIN' as const };
  const primeiro = await AuthService.registrar(dados);
  assert.equal(primeiro.usuario.email, 'admin@example.test');
  assert.equal(lojas, 1);
  await assert.rejects(AuthService.registrar({ ...dados, barbeariaId: 'outra' }), /já está cadastrado/);
  await assert.rejects(AuthService.registrar(dados), /já está cadastrado/);
  assert.equal(lojas, 1, 'duplicidade não cria barbearia órfã');
  await AuthService.registrar({ ...dados, papel: 'CLIENTE', barbeariaId: 'cliente-a' });
  await AuthService.registrar({ ...dados, papel: 'CLIENTE', barbeariaId: 'cliente-b' });
  await AuthService.registrar({ ...dados, papel: 'BARBEIRO', barbeariaId: 'barbeiro-a' });
  await AuthService.registrar({ ...dados, papel: 'BARBEIRO', barbeariaId: 'barbeiro-b' });
  assert.equal((await AuthService.login({ ...dados, email: 'admin@example.test' })).usuario.id, primeiro.usuario.id);
  assert.equal((await AuthService.login({ ...dados, papel: 'CLIENTE', barbeariaId: 'cliente-b' })).usuario.barbeariaId, 'cliente-b');
  falharCriacao = true;
  await assert.rejects(AuthService.registrar({ ...dados, email: 'novo@example.test' }), /Falha simulada/);
  assert.equal(lojas, 1, 'erro ao criar usuário reverte barbearia');
  falharCriacao = false;
  await assert.rejects(AuthService.login({ ...dados, senha: 'invalida' }), /Email ou senha incorretos/);
  console.log('PASS: email ADMIN exclusivo, normalização, clientes/barbeiros multiunidade, rollback e login existente preservado.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
