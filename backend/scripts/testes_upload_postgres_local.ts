import assert from 'node:assert/strict';
import sharp from 'sharp';
import type { BucketUpload, AtorUpload } from '../src/services/supabase.service';

// Banco NOVO, exclusivamente sintético. Não carrega .env e nunca chama um provedor.
assert.equal(process.env.ALLOW_LOCAL_SECURITY_TEST, '1');
for (const chave of ['DATABASE_URL', 'DIRECT_URL']) {
  const url = new URL(process.env[chave] ?? '');
  assert.equal(url.protocol, 'postgresql:'); assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.port, '55439'); assert.equal(url.pathname, '/valen_upload_test');
  assert.equal(url.username, 'valen_test'); assert.equal(url.search, '');
}

function barreira() {
  let resolver!: () => void;
  const promise = new Promise<void>(resolve => { resolver = resolve; });
  return { promise, resolver };
}

async function main() {
  const { prisma } = await import('../src/lib/prisma');
  const { SupabaseService } = await import('../src/services/supabase.service');
  const objetos = new Map<string, Buffer>();
  const chamadas: string[] = [];
  let antesImagem: ((path: string) => Promise<void>) | null = null;
  const bucket = (nome: string): BucketUpload => ({
    upload: async (path, bytes, opcoes) => {
      assert.equal(opcoes.upsert, false); assert.equal(opcoes.contentType, 'image/webp');
      if (path.includes('/arquivos/')) await antesImagem?.(path);
      const chave = `${nome}/${path}`; chamadas.push(`upload:${chave}`);
      if (objetos.has(chave)) return { error: new Error('conflito-sintetico') };
      objetos.set(chave, Buffer.from(bytes)); return { error: null };
    },
    list: async (prefixo, { limit, offset }) => {
      chamadas.push(`list:${nome}/${prefixo}`);
      const prefixoCompleto = `${nome}/${prefixo}/`;
      return { error: null, data: [...objetos.entries()].filter(([key]) => key.startsWith(prefixoCompleto)).sort(([a], [b]) => a.localeCompare(b))
        .slice(offset, offset + limit).map(([key, bytes]) => ({ name: key.slice(prefixoCompleto.length), id: key, metadata: { size: bytes.length } })) };
    },
    remove: async paths => {
      const data = paths.filter(path => objetos.has(`${nome}/${path}`)).map(name => ({ name }));
      paths.forEach(path => { chamadas.push(`remove:${nome}/${path}`); objetos.delete(`${nome}/${path}`); });
      return { error: null, data };
    },
    getPublicUrl: path => ({ data: { publicUrl: `https://imagens.example.test/${nome}/${path}` } }),
  });
  const adaptador = SupabaseService as unknown as { getClient: () => { storage: { from: (nome: string) => BucketUpload } } };
  const getClientOriginal = adaptador.getClient;
  adaptador.getClient = () => ({ storage: { from: bucket } });
  let triggerCriado = false;
  try {
    const [conexao] = await prisma.$queryRaw<{ banco: string; host: string; usuario: string }[]>`SELECT current_database() AS banco, host(inet_server_addr()) AS host, current_user AS usuario`;
    assert.deepEqual(conexao, { banco: 'valen_upload_test', host: '127.0.0.1', usuario: 'valen_test' });
    assert.equal(await prisma.barbearia.count(), 0, 'Exige banco novo sem dados anteriores');
    assert.equal(await prisma.usuario.count(), 0);
    const lojaA = await prisma.barbearia.create({ data: { nome: 'Upload sintético A', slug: 'upload-fixture-a', logo: 'https://legado.example.test/a.jpg' } });
    const lojaB = await prisma.barbearia.create({ data: { nome: 'Upload sintético B', slug: 'upload-fixture-b', logo: 'https://legado.example.test/b.jpg' } });
    const criarAdmin = (barbeariaId: string, indice: string) => prisma.usuario.create({ data: {
      barbeariaId, nome: `Admin sintético ${indice}`, email: `admin-${indice}@example.test`, senha: 'hash-sintetico-sem-login', papel: 'ADMIN',
    } });
    const adminA = await criarAdmin(lojaA.id, 'a'); const adminB = await criarAdmin(lojaB.id, 'b');
    const criarBarbeiro = (barbeariaId: string, indice: string, foto: string) => prisma.barbeiro.create({ data: {
      barbearia: { connect: { id: barbeariaId } }, especialidades: [], foto,
      usuario: { create: { barbearia: { connect: { id: barbeariaId } }, nome: `Barbeiro sintético ${indice}`, email: `barbeiro-${indice}@example.test`, senha: 'hash-sintetico-sem-login', papel: 'BARBEIRO' } },
    } });
    const barbeiroA = await criarBarbeiro(lojaA.id, 'a', 'https://legado.example.test/barbeiro-a.jpg');
    const barbeiroB = await criarBarbeiro(lojaB.id, 'b', 'https://legado.example.test/barbeiro-b.jpg');
    const barbeiroFalha = await criarBarbeiro(lojaA.id, 'falha', 'https://legado.example.test/falha-commit.jpg');
    const atorA: AtorUpload = { barbeariaId: lojaA.id, usuarioId: adminA.id, papel: 'ADMIN' };
    const atorB: AtorUpload = { barbeariaId: lojaB.id, usuarioId: adminB.id, papel: 'ADMIN' };
    const imagem = await sharp({ create: { width: 24, height: 24, channels: 3, background: 'blue' } }).png().toBuffer();
    objetos.set('barbeiros/arquivo-legado.jpg', Buffer.from('legado-sintetico'));
    const antesNegadas = chamadas.length;
    await assert.rejects(SupabaseService.uploadImage('barbeiros', atorA, imagem, 'image/png', barbeiroB.id), { status: 403 });
    await assert.rejects(SupabaseService.uploadImage('barbeiros', { ...atorA, papel: 'BARBEIRO', usuarioId: barbeiroA.usuarioId, barbeiroId: barbeiroA.id }, imagem, 'image/png', barbeiroB.id), { status: 403 });
    await assert.rejects(SupabaseService.uploadImage('barbearias', { ...atorA, usuarioId: adminB.id }, imagem, 'image/png'), { status: 403 });
    assert.equal(chamadas.length, antesNegadas, 'negação de propriedade ocorre antes do armazenamento');

    const iniciou = barreira(); const liberar = barreira();
    antesImagem = async path => { if (path.includes(`/${barbeiroA.id}/`)) { iniciou.resolver(); await liberar.promise; } };
    const primeiro = SupabaseService.uploadImage('barbeiros', atorA, imagem, 'image/png', barbeiroA.id);
    await iniciou.promise;
    assert.equal((await prisma.barbeiro.findUniqueOrThrow({ where: { id: barbeiroA.id } })).foto, barbeiroA.foto);
    const antesConcorrente = chamadas.length;
    await assert.rejects(SupabaseService.uploadImage('barbeiros', atorA, imagem, 'image/png', barbeiroA.id), { status: 429 });
    assert.equal(chamadas.length, antesConcorrente, 'lock distribuído recusa antes de atingir provedor');
    const outraUnidade = await SupabaseService.uploadImage('barbeiros', atorB, imagem, 'image/png', barbeiroB.id);
    assert.equal((await prisma.barbeiro.findUniqueOrThrow({ where: { id: barbeiroB.id } })).foto, outraUnidade);
    liberar.resolver(); const primeiraUrl = await primeiro; antesImagem = null;
    assert.equal((await prisma.barbeiro.findUniqueOrThrow({ where: { id: barbeiroA.id } })).foto, primeiraUrl);
    const segundaUrl = await SupabaseService.uploadImage('barbeiros', atorA, imagem, 'image/png', barbeiroA.id);
    assert.notEqual(segundaUrl, primeiraUrl);
    assert.ok(objetos.has(primeiraUrl.replace('https://imagens.example.test/', '')));
    const terceiraUrl = await SupabaseService.uploadImage('barbeiros', atorA, imagem, 'image/png', barbeiroA.id);
    assert.ok(!objetos.has(primeiraUrl.replace('https://imagens.example.test/', '')));
    assert.ok(objetos.has(segundaUrl.replace('https://imagens.example.test/', '')));
    assert.ok(objetos.has(terceiraUrl.replace('https://imagens.example.test/', '')));
    console.log('PASS PostgreSQL: propriedade, concorrência mesma unidade, independência de tenants e referências atuais preservadas');

    // Erro real apenas no COMMIT, depois que callback e operações do Storage terminaram.
    await prisma.$executeRawUnsafe(`CREATE FUNCTION upload_teste_falhar_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.foto = 'https://legado.example.test/falha-commit.jpg' AND NEW.foto LIKE '%imagens-v2/%' THEN RAISE EXCEPTION 'falha-sintetica-no-commit'; END IF; RETURN NEW; END $$`);
    await prisma.$executeRawUnsafe(`CREATE CONSTRAINT TRIGGER upload_teste_commit AFTER UPDATE ON barbeiros DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION upload_teste_falhar_commit()`);
    triggerCriado = true;
    await assert.rejects(SupabaseService.uploadImage('barbeiros', atorA, imagem, 'image/png', barbeiroFalha.id), { status: 503 });
    assert.equal((await prisma.barbeiro.findUniqueOrThrow({ where: { id: barbeiroFalha.id } })).foto, barbeiroFalha.foto, 'rollback real mantém foto anterior');
    const prefixoFalha = `barbeiros/imagens-v2/${lojaA.id}/${barbeiroFalha.id}/arquivos/`;
    assert.equal([...objetos.keys()].filter(p => p.startsWith(prefixoFalha)).length, 1, 'upload confirmado sem commit fica somente como órfão recuperável');
    await prisma.$executeRawUnsafe('DROP TRIGGER upload_teste_commit ON barbeiros');
    await prisma.$executeRawUnsafe('DROP FUNCTION upload_teste_falhar_commit()'); triggerCriado = false;
    const recuperada = await SupabaseService.uploadImage('barbeiros', atorA, imagem, 'image/png', barbeiroFalha.id);
    assert.equal((await prisma.barbeiro.findUniqueOrThrow({ where: { id: barbeiroFalha.id } })).foto, recuperada);
    assert.equal([...objetos.keys()].filter(p => p.startsWith(prefixoFalha)).length, 1, 'retry recicla exclusivamente órfão gerenciado');
    console.log('PASS PostgreSQL: falha diferida no commit preserva foto legada; retry seguro depois da recuperação');

    const iniciouCas = barreira(); const liberarCas = barreira();
    antesImagem = async path => { if (path.includes(`/${barbeiroA.id}/`)) { iniciouCas.resolver(); await liberarCas.promise; } };
    const disputada = SupabaseService.uploadImage('barbeiros', atorA, imagem, 'image/png', barbeiroA.id);
    await iniciouCas.promise;
    await prisma.barbeiro.update({ where: { id: barbeiroA.id }, data: { foto: null } });
    liberarCas.resolver(); await assert.rejects(disputada, { status: 409 }); antesImagem = null;
    assert.equal((await prisma.barbeiro.findUniqueOrThrow({ where: { id: barbeiroA.id } })).foto, null, 'CAS preserva limpeza legítima concorrente');
    assert.ok(objetos.has(terceiraUrl.replace('https://imagens.example.test/', '')), 'nem falha de CAS apaga a foto que era atual ao iniciar');
    assert.deepEqual(objetos.get('barbeiros/arquivo-legado.jpg'), Buffer.from('legado-sintetico'));
    assert.equal(await prisma.barbearia.count(), 2); assert.equal(await prisma.barbeiro.count(), 3); assert.equal(await prisma.usuario.count(), 5);
    console.log('PASS PostgreSQL: CAS real, falha concorrente mantém referência vencedora e nenhum arquivo legado é alterado');
  } finally {
    adaptador.getClient = getClientOriginal;
    if (triggerCriado) {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS upload_teste_commit ON barbeiros');
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS upload_teste_falhar_commit()');
    }
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
