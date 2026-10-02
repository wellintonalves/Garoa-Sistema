import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

// Só executar em um banco NOVO e descartável, criado pelo operador em loopback.
// Não carrega .env. Provedores de email são substituídos antes de qualquer envio.
assert.equal(process.env.ALLOW_LOCAL_SECURITY_TEST, '1');
for (const chave of ['DATABASE_URL', 'DIRECT_URL']) {
  const url = new URL(process.env[chave] ?? '');
  assert.equal(url.protocol, 'postgresql:');
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.port, '55439');
  assert.equal(url.pathname, '/valen_security_test');
  assert.equal(url.username, 'valen_test');
  assert.equal(url.search, '', 'não aceitar redirecionamento via parâmetros da conexão');
}
process.env.JWT_SECRET = 'postgres-teste-admin-segredo-sintetico';
process.env.JWT_SECRET_CLIENTE = 'postgres-teste-cliente-segredo-sintetico';
process.env.JWT_SECRET_BARBEIRO = 'postgres-teste-barbeiro-segredo-sintetico';
delete process.env.RESEND_API_KEY;

const aceiteDocumentos = { aceito: true, termosVersao: '2026-09-15', privacidadeVersao: '2026-09-15' };
const dados = { nome: 'Teste Isolado', email: 'dono@example.test', senha: 'senha-sintetica', aceiteDocumentos };
const envios: { finalidade: 'verificacao' | 'recuperacao'; email: string; codigo: string }[] = [];

async function main() {
  const { prisma } = await import('../src/lib/prisma');
  const { AuthService } = await import('../src/services/auth.service');
  const { ClienteAppService } = await import('../src/services/clienteApp.service');
  const { VerificacaoService } = await import('../src/services/verificacao.service');
  const { EmailService } = await import('../src/services/email.service');
  const verificarOriginal = EmailService.enviarCodigoVerificacao;
  const recuperarOriginal = EmailService.enviarCodigoRecuperacaoSenha;
  EmailService.enviarCodigoVerificacao = async (email, _nome, codigo) => { envios.push({ finalidade: 'verificacao', email, codigo }); };
  EmailService.enviarCodigoRecuperacaoSenha = async (email, _nome, codigo) => { envios.push({ finalidade: 'recuperacao', email, codigo }); };
  try {
    const [conexao] = await prisma.$queryRaw<{ banco: string; host: string }[]>`SELECT current_database() AS banco, host(inet_server_addr()) AS host`;
    assert.deepEqual(conexao, { banco: 'valen_security_test', host: '127.0.0.1' });
    assert.equal(await prisma.usuario.count(), 0, 'o banco deve estar vazio antes de criar fixtures');
    assert.equal(await prisma.barbearia.count(), 0);

    for (const papel of ['CLIENTE', 'BARBEIRO'] as const) {
      await assert.rejects(AuthService.registrar({ ...dados, papel }), { status: 400 });
    }
    await assert.rejects(AuthService.registrar({ ...dados, papel: 'ADMIN', barbeariaId: 'tenant-alheio' }), { status: 400 });
    assert.equal(await prisma.usuario.count(), 0);
    assert.equal(await prisma.barbearia.count(), 0);
    const concorrentes = await Promise.allSettled([
      AuthService.registrar(dados),
      AuthService.registrar({ ...dados, email: ' DONO@example.test ', papel: 'ADMIN' }),
    ]);
    assert.equal(concorrentes.filter(r => r.status === 'fulfilled').length, 1);
    const rejeitado = concorrentes.find(r => r.status === 'rejected');
    assert.ok(rejeitado && rejeitado.status === 'rejected');
    assert.equal(rejeitado.reason.status, 409);
    assert.equal(await prisma.usuario.count({ where: { papel: 'ADMIN' } }), 1);
    assert.equal(await prisma.barbearia.count(), 1, 'concorrência/duplicidade não deixa unidade órfã');
    const dono = await prisma.usuario.findFirstOrThrow({ where: { email: dados.email, papel: 'ADMIN' } });
    assert.ok(dono.barbeariaId);
    assert.equal((await AuthService.login({ ...dados, papel: 'ADMIN' })).usuario.id, dono.id);
    console.log('PASS PostgreSQL: dois cadastros concorrentes resultam em um proprietário/uma unidade; tentativas de papel/unidade alheia não gravam.');

    const unidadeA = await prisma.barbearia.create({ data: { nome: 'Unidade A', slug: 'seguranca-unidade-a' } });
    const unidadeB = await prisma.barbearia.create({ data: { nome: 'Unidade B', slug: 'seguranca-unidade-b' } });
    const inativa = await prisma.barbearia.create({ data: { nome: 'Inativa', slug: 'seguranca-inativa', ativo: false } });
    await assert.rejects(AuthService.registrarCliente({ ...dados, barbeariaId: inativa.id }), { status: 404 });
    await assert.rejects(AuthService.registrarCliente({ ...dados, barbeariaId: unidadeA.id, papel: 'BARBEIRO' }), { status: 400 });
    const clienteA = await AuthService.registrarCliente({ ...dados, barbeariaId: unidadeA.id });
    const clienteB = await AuthService.registrarCliente({ ...dados, barbeariaId: unidadeB.id });
    assert.equal(clienteA.usuario.papel, 'CLIENTE');
    assert.equal(clienteB.usuario.papel, 'CLIENTE');
    await assert.rejects(AuthService.registrarCliente({ ...dados, barbeariaId: unidadeA.id }), { status: 409 });

    const antigos = [];
    for (const [indice, barbeariaId] of [unidadeA.id, unidadeB.id, null].entries()) {
      const usuario = await prisma.usuario.create({ data: {
        nome: `Cliente antigo ${indice}`, email: `antigo-${indice}@example.test`, senha: 'hash-sintetico',
        papel: 'CLIENTE', barbeariaId, emailVerificado: false, createdAt: new Date('2020-01-01T12:00:00Z'),
      } });
      const cliente = await prisma.cliente.create({ data: { usuarioId: usuario.id, barbeariaId } });
      const ponto = await prisma.pontoFidelidade.create({ data: {
        clienteId: cliente.id, barbeariaId: barbeariaId ?? unidadeA.id, pontos: 10, saldoApos: 10, descricao: 'Histórico sintético',
      } });
      antigos.push({ usuario, cliente, ponto });
    }
    const cadastroGlobal = { ...dados, email: 'global@example.test', dataNascimento: '1990-01-01', barbeariaId: unidadeA.id };
    const global = await ClienteAppService.registrar(cadastroGlobal);
    assert.equal(global.isNovo, true);
    assert.equal((await prisma.usuario.findUniqueOrThrow({ where: { id: global.cliente.usuarioId } })).barbeariaId, null);
    assert.equal(await prisma.clienteBarbearia.count({ where: { clienteId: global.cliente.clienteId, barbeariaId: unidadeA.id } }), 1);
    await prisma.usuario.update({ where: { id: global.cliente.usuarioId }, data: { createdAt: new Date('2020-01-01T12:00:00Z') } });
    const repetido = await ClienteAppService.registrar({ ...cadastroGlobal, nome: 'Nome atualizado' });
    assert.equal(repetido.isNovo, false);
    assert.equal(repetido.cliente.usuarioId, global.cliente.usuarioId);
    assert.equal(repetido.cliente.clienteId, global.cliente.clienteId);
    await prisma.usuario.update({ where: { id: global.cliente.usuarioId }, data: { emailVerificado: true } });
    await assert.rejects(ClienteAppService.registrar(cadastroGlobal), /já está cadastrado/);
    for (const antigo of antigos) {
      assert.deepEqual(await prisma.usuario.findUnique({ where: { id: antigo.usuario.id } }), antigo.usuario);
      assert.deepEqual(await prisma.cliente.findUnique({ where: { id: antigo.cliente.id } }), antigo.cliente);
      assert.deepEqual(await prisma.pontoFidelidade.findUnique({ where: { id: antigo.ponto.id } }), antigo.ponto);
    }
    console.log('PASS PostgreSQL: clientes multiunidade, convite, repetição e duplicidade global preservam contas antigas e histórico de fidelidade.');

    await VerificacaoService.enviarCodigo(dono.id);
    const emailVerificacao = envios.at(-1)!;
    assert.equal(emailVerificacao.email, dono.email);
    assert.match(emailVerificacao.codigo, /^\d{6}$/);
    const desafioDono = await prisma.usuario.findUniqueOrThrow({ where: { id: dono.id } });
    const desafio = JSON.parse(desafioDono.codigoVerificacao!);
    assert.match(desafio.resumo, /^[a-f0-9]{64}$/);
    assert.equal(desafio.codigo, undefined, 'não persistir código em texto puro');
    assert.equal(desafio.finalidade, 'verificacao');
    await assert.rejects(VerificacaoService.redefinirSenha(dono.email, emailVerificacao.codigo, 'nova-senha-sintetica', { papel: 'ADMIN' }), /inválido/);
    const consumos = await Promise.all(Array.from({ length: 10 }, () => VerificacaoService.verificarCodigo(dono.id, emailVerificacao.codigo)));
    assert.equal(consumos.filter(Boolean).length, 1, 'somente um consumidor pode confirmar');
    const verificado = await prisma.usuario.findUniqueOrThrow({ where: { id: dono.id } });
    assert.equal(verificado.emailVerificado, true);
    assert.equal(verificado.codigoVerificacao, null);
    assert.equal(await VerificacaoService.verificarCodigo(dono.id, emailVerificacao.codigo), false, 'código consumido não pode ser reutilizado');

    // Mesmo email em três contas: recuperação sem contexto não seleciona a primeira.
    const antesAmbiguo = envios.length;
    await VerificacaoService.enviarCodigoRecuperacao(dono.email);
    assert.equal(envios.length, antesAmbiguo);
    await VerificacaoService.enviarCodigoRecuperacao(dono.email, { papel: 'CLIENTE', barbeariaSlug: unidadeA.slug });
    const recuperacao = envios.at(-1)!;
    assert.equal(recuperacao.finalidade, 'recuperacao');
    assert.equal(recuperacao.email, dono.email);
    const alvo = await prisma.usuario.findUniqueOrThrow({ where: { id: clienteA.usuario.id } });
    const intactoB = await prisma.usuario.findUniqueOrThrow({ where: { id: clienteB.usuario.id } });
    assert.ok(alvo.codigoVerificacao);
    assert.equal(intactoB.codigoVerificacao, null);
    assert.equal(await VerificacaoService.verificarCodigo(alvo.id, recuperacao.codigo), false, 'recuperação não confirma email');
    const redefinicoes = await Promise.allSettled(Array.from({ length: 5 }, () => VerificacaoService.redefinirSenha(
      dono.email, recuperacao.codigo, 'senha-trocada-sintetica', { papel: 'CLIENTE', barbeariaSlug: unidadeA.slug },
    )));
    assert.equal(redefinicoes.filter(r => r.status === 'fulfilled').length, 1);
    const senhaNova = await prisma.usuario.findUniqueOrThrow({ where: { id: alvo.id } });
    assert.ok(await bcrypt.compare('senha-trocada-sintetica', senhaNova.senha));
    assert.equal(senhaNova.codigoVerificacao, null);
    assert.deepEqual(await prisma.usuario.findUnique({ where: { id: intactoB.id } }), intactoB, 'outra conta com mesmo email fica intacta');
    assert.equal((await prisma.usuario.findUniqueOrThrow({ where: { id: dono.id } })).senha, dono.senha);
    await assert.rejects(VerificacaoService.redefinirSenha(dono.email, recuperacao.codigo, 'outra-senha-sintetica', { papel: 'CLIENTE', barbeariaSlug: unidadeA.slug }), /inválido/);
    console.log('PASS PostgreSQL: desafio não guarda OTP puro; finalidade, consumo único concorrente e recuperação por papel/unidade preservam identidades.');

    const usuarioLimite = antigos[0].usuario;
    await VerificacaoService.enviarCodigo(usuarioLimite.id);
    const codigoLimite = envios.at(-1)!.codigo;
    const errado = codigoLimite === '000000' ? '999999' : '000000';
    assert.deepEqual(await Promise.all(Array.from({ length: 20 }, () => VerificacaoService.verificarCodigo(usuarioLimite.id, errado))), Array(20).fill(false));
    for (let i = 0; i < 5; i++) assert.equal(await VerificacaoService.verificarCodigo(usuarioLimite.id, errado), false);
    const bloqueado = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioLimite.id } });
    assert.equal(JSON.parse(bloqueado.codigoVerificacao!).tentativas, 5, 'concorrência não ultrapassa orçamento');
    assert.equal(await VerificacaoService.verificarCodigo(usuarioLimite.id, codigoLimite), false);
    const antesReenvio = envios.length;
    await Promise.all(Array.from({ length: 10 }, () => VerificacaoService.enviarCodigo(usuarioLimite.id)));
    assert.equal(envios.length, antesReenvio, 'reenvio não reinicia orçamento bloqueado');

    const usuarioExpirado = antigos[1].usuario;
    await VerificacaoService.enviarCodigo(usuarioExpirado.id);
    const codigoExpirado = envios.at(-1)!.codigo;
    await prisma.usuario.update({ where: { id: usuarioExpirado.id }, data: { codigoExpiracao: new Date(Date.now() - 1000) } });
    assert.equal(await VerificacaoService.verificarCodigo(usuarioExpirado.id, codigoExpirado), false);
    await prisma.usuario.update({ where: { id: usuarioExpirado.id }, data: { codigoVerificacao: '123456', codigoExpiracao: new Date(Date.now() + 60_000) } });
    assert.equal(await VerificacaoService.verificarCodigo(usuarioExpirado.id, '123456'), false, 'código legado puro não é aceito');
    console.log('PASS PostgreSQL: orçamento de tentativas resiste a concorrência; reenvio não desbloqueia, códigos expirados/legados falham.');
  } finally {
    EmailService.enviarCodigoVerificacao = verificarOriginal;
    EmailService.enviarCodigoRecuperacaoSenha = recuperarOriginal;
    await prisma.$disconnect();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
