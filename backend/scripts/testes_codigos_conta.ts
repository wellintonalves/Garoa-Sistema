import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

process.env.JWT_SECRET = 'teste-codigos-conta-admin-segredo-local';
process.env.JWT_SECRET_CLIENTE = 'teste-codigos-conta-cliente-segredo-local';
process.env.JWT_SECRET_BARBEIRO = 'teste-codigos-conta-barbeiro-segredo-local';
delete process.env.RESEND_API_KEY;

const agoraReal = Date.now;
let agora = agoraReal();
Date.now = () => agora;
let usuarios: any[] = [];
let hook: (() => void) | undefined;
const mensagens: { finalidade: string; email: string; nome: string; codigo: string }[] = [];
const novo = (id: string, extra: any = {}) => ({ id, nome: `Nome ${id}`, email: `${id}@example.test`, papel: 'ADMIN',
  barbeariaId: `loja-${id}`, barbearia: { slug: `loja-${id}` }, emailVerificado: false, senha: 'hash-original',
  codigoVerificacao: null, codigoExpiracao: null, ...extra });
function igual(u: any, where: any): boolean {
  return Object.entries(where).every(([chave, valor]: [string, any]) => {
    if (chave === 'AND') return igual(u, valor);
    if (chave === 'email' && typeof valor === 'object') return u.email.toLowerCase() === valor.equals;
    if (chave === 'barbearia') return u.barbearia?.slug === valor.slug;
    if (chave === 'codigoExpiracao' && valor && !(valor instanceof Date)) return u.codigoExpiracao > valor.gt;
    if (valor instanceof Date) return u[chave]?.getTime() === valor.getTime();
    return u[chave] === valor;
  });
}
const fake = { usuario: {
  findUnique: async ({ where }: any) => { const u = usuarios.find(u => u.id === where.id); return u ? { ...u } : null; },
  findMany: async ({ where, take }: any) => usuarios.filter(u => igual(u, where)).slice(0, take).map(u => ({ ...u })),
  updateMany: async ({ where, data }: any) => {
    const executar = hook; hook = undefined; executar?.();
    const encontrados = usuarios.filter(u => igual(u, where));
    encontrados.forEach(u => Object.assign(u, data));
    return { count: encontrados.length };
  },
} };
(globalThis as any).prisma = { $extends: () => fake };
let testes = 0;
async function testar(nome: string, fn: () => Promise<void>) {
  usuarios = [novo('alvo')]; mensagens.length = 0; hook = undefined; agora += 20 * 60 * 1000;
  await fn(); testes++; console.log(`PASS: ${nome}`);
}

async function main() {
  const { VerificacaoService: svc } = await import('../src/services/verificacao.service');
  const { EmailService } = await import('../src/services/email.service');
  EmailService.enviarCodigoVerificacao = async (email, nome, codigo) => { mensagens.push({ finalidade: 'verificacao', email, nome, codigo }); };
  EmailService.enviarCodigoRecuperacaoSenha = async (email, nome, codigo) => { mensagens.push({ finalidade: 'recuperacao', email, nome, codigo }); };
  const verificar = () => svc.enviarCodigo('alvo');
  const recuperar = () => svc.enviarCodigoRecuperacao('alvo@example.test');
  const redefinir = (codigo: string) => svc.redefinirSenha('alvo@example.test', codigo, 'senha-nova-segura');
  const codigo = () => mensagens.at(-1)!.codigo;

  await testar('destino persistido e código não armazenado em claro', async () => {
    await (svc.enviarCodigo as any)('alvo', 'outro@example.test', 'Outro nome');
    assert.equal(mensagens[0].email, 'alvo@example.test'); assert.equal(mensagens[0].nome, 'Nome alvo');
    assert.match(codigo(), /^\d{6}$/); const d = JSON.parse(usuarios[0].codigoVerificacao);
    assert.equal(d.finalidade, 'verificacao'); assert.match(d.resumo, /^[a-f0-9]{64}$/); assert.notEqual(d.resumo, codigo());
  });
  await testar('verificação não redefine senha', async () => {
    await verificar(); await assert.rejects(redefinir(codigo()), /inválido/); assert.equal(usuarios[0].senha, 'hash-original');
    assert.equal(await svc.verificarCodigo('alvo', codigo()), true);
  });
  await testar('recuperação não confirma email', async () => {
    await recuperar(); assert.equal(await svc.verificarCodigo('alvo', codigo()), false);
    await redefinir(codigo()); assert.equal(usuarios[0].emailVerificado, false); assert.ok(await bcrypt.compare('senha-nova-segura', usuarios[0].senha));
  });
  await testar('consumo único da confirmação', async () => {
    await verificar(); assert.equal(await svc.verificarCodigo('alvo', codigo()), true);
    assert.equal(await svc.verificarCodigo('alvo', codigo()), false); assert.equal(usuarios[0].codigoVerificacao, null);
  });
  await testar('consumo único da recuperação', async () => {
    await recuperar(); await redefinir(codigo()); await assert.rejects(redefinir(codigo()), /inválido/);
  });
  await testar('expiração no limite da janela', async () => {
    await recuperar(); agora = usuarios[0].codigoExpiracao.getTime(); await assert.rejects(redefinir(codigo()), /inválido/);
  });
  await testar('códigos legados são rejeitados', async () => {
    usuarios[0].codigoVerificacao = '123456'; usuarios[0].codigoExpiracao = new Date(agora + 60000);
    assert.equal(await svc.verificarCodigo('alvo', '123456'), false); await assert.rejects(redefinir('123456'), /inválido/);
  });
  await testar('mudança de email invalida desafio', async () => {
    await recuperar(); usuarios[0].email = 'novo@example.test';
    await assert.rejects(svc.redefinirSenha('novo@example.test', codigo(), 'senha-nova'), /inválido/);
  });
  await testar('mudança de unidade invalida desafio', async () => {
    await verificar(); usuarios[0].barbeariaId = 'outra'; assert.equal(await svc.verificarCodigo('alvo', codigo()), false);
  });
  await testar('desafio copiado para outra identidade é rejeitado', async () => {
    await verificar(); usuarios.push(novo('outro', { codigoVerificacao: usuarios[0].codigoVerificacao, codigoExpiracao: usuarios[0].codigoExpiracao }));
    assert.equal(await svc.verificarCodigo('outro', codigo()), false);
  });
  await testar('cinco erros bloqueiam desafio e reenvio até expirar', async () => {
    await recuperar(); const correto = codigo(); const errado = correto === '000000' ? '999999' : '000000';
    for (let i = 0; i < 5; i++) await assert.rejects(redefinir(errado));
    await assert.rejects(redefinir(correto)); agora += 61000; await recuperar(); assert.equal(mensagens.length, 1);
    agora += 600000; await recuperar(); await redefinir(codigo());
  });
  await testar('paralelismo não permite mais palpites por tentativa reservada', async () => {
    await recuperar(); const correto = codigo(); const errado = correto === '000000' ? '999999' : '000000';
    const resultados = await Promise.allSettled([...Array(30).fill(errado), correto].map(redefinir));
    assert.ok(resultados.every(r => r.status === 'rejected')); assert.equal(JSON.parse(usuarios[0].codigoVerificacao).tentativas, 1);
    assert.equal(usuarios[0].senha, 'hash-original');
  });
  await testar('duas redefinições simultâneas têm um vencedor', async () => {
    await recuperar(); const r = await Promise.allSettled([redefinir(codigo()), redefinir(codigo())]);
    assert.equal(r.filter(x => x.status === 'fulfilled').length, 1);
  });
  await testar('cooldown, limite de envios e expiração fixa', async () => {
    await recuperar(); const primeiro = codigo(), expira = usuarios[0].codigoExpiracao.getTime();
    await recuperar(); assert.equal(mensagens.length, 1);
    agora += 60000; await recuperar(); assert.equal(mensagens.length, 2); assert.equal(usuarios[0].codigoExpiracao.getTime(), expira);
    await assert.rejects(redefinir(primeiro)); agora += 60000; await recuperar(); agora += 60000; await recuperar(); assert.equal(mensagens.length, 3);
  });
  await testar('emails duplicados nunca selecionam conta arbitrariamente', async () => {
    usuarios.push(novo('cliente', { email: 'alvo@example.test', papel: 'CLIENTE', barbeariaId: null, barbearia: null }));
    await recuperar(); assert.equal(mensagens.length, 0);
    await svc.enviarCodigoRecuperacao(' ALVO@example.test ', { papel: 'CLIENTE' });
    assert.equal(mensagens.length, 1); assert.equal(usuarios[0].codigoVerificacao, null);
    await svc.redefinirSenha('alvo@example.test', codigo(), 'senha-cliente', { papel: 'CLIENTE' });
    assert.equal(usuarios[0].senha, 'hash-original'); assert.ok(await bcrypt.compare('senha-cliente', usuarios[1].senha));
  });
  await testar('contas na mesma função são isoladas pelo endereço da unidade', async () => {
    usuarios[0].papel = 'BARBEIRO'; usuarios.push(novo('outra', { email: 'alvo@example.test', papel: 'BARBEIRO' }));
    await svc.enviarCodigoRecuperacao('alvo@example.test', { papel: 'BARBEIRO' }); assert.equal(mensagens.length, 0);
    const contexto = { papel: 'BARBEIRO' as const, barbeariaSlug: ' LOJA-OUTRA ' };
    await svc.enviarCodigoRecuperacao('alvo@example.test', contexto); await svc.redefinirSenha('alvo@example.test', codigo(), 'senha-outra', contexto);
    assert.equal(usuarios[0].senha, 'hash-original'); assert.ok(await bcrypt.compare('senha-outra', usuarios[1].senha));
  });
  await testar('conta ausente/contexto inválido não expõem existência', async () => {
    await svc.enviarCodigoRecuperacao('ausente@example.test'); await svc.enviarCodigoRecuperacao('alvo@example.test', { papel: 'SUPER' as any });
    await svc.enviarCodigo('ausente'); assert.equal(mensagens.length, 0);
  });
  await testar('emissão concorrente envia somente o desafio persistido', async () => {
    await Promise.all([verificar(), verificar()]); assert.equal(mensagens.length, 1);
  });
  await testar('CAS de emissão recusa identidade alterada depois da leitura', async () => {
    hook = () => { usuarios[0].email = 'novo@example.test'; }; await verificar(); assert.equal(mensagens.length, 0); assert.equal(usuarios[0].codigoVerificacao, null);
  });
  await testar('CAS de tentativa não sobrescreve desafio concorrente', async () => {
    await recuperar(); hook = () => { usuarios[0].codigoVerificacao = 'substituido'; };
    await assert.rejects(redefinir(codigo())); assert.equal(usuarios[0].codigoVerificacao, 'substituido'); assert.equal(usuarios[0].senha, 'hash-original');
  });
  await testar('verificação de conta já confirmada não substitui recuperação', async () => {
    usuarios[0].emailVerificado = true; await recuperar(); const antes = usuarios[0].codigoVerificacao; agora += 61000;
    await verificar(); assert.equal(usuarios[0].codigoVerificacao, antes);
  });
  console.log(`PASS: ${testes} cenários de códigos de conta (persistência simulada, nenhum email real).`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { Date.now = agoraReal; });
