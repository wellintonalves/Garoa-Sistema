import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { PrismaClient } from '@prisma/client';
import { guiaSistema, ferramentaAjuda, consultarAjuda } from '../src/services/ia/ajudaSistema';
import { responderTextoOpenAI } from '../src/services/ia/openaiTexto';
import { ContextoIa } from '../src/services/ia/cotas';

const url = process.env.IA_TEST_DATABASE_URL;
if (!url || new URL(url).hostname !== '127.0.0.1' || new URL(url).pathname !== '/valen_ia_test') throw new Error('Use somente o banco local de teste.');
const db = new PrismaClient({ datasourceUrl: url });
async function main() {
  const raiz = resolve(__dirname, '../..');
  const app = ts.createSourceFile('App.tsx', readFileSync(resolve(raiz, 'frontend/src/App.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const rotas = new Set<string>();
  function visitar(node: ts.Node, pai = '') {
    const abertura = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : undefined;
    let caminho = pai;
    if (abertura?.tagName.getText(app) === 'Route') {
      const atributo = abertura.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(app) === 'path');
      if (atributo && ts.isJsxAttribute(atributo) && atributo.initializer && ts.isStringLiteral(atributo.initializer)) {
        const path = atributo.initializer.text;
        caminho = path.startsWith('/') ? path : `${pai}/${path}`;
        rotas.add(caminho);
      }
    }
    node.forEachChild(filho => visitar(filho, caminho));
  }
  visitar(app);
  for (const artigo of guiaSistema) {
    assert.ok(rotas.has(artigo.rota.split('?')[0]), `Rota inexistente: ${artigo.rota}`);
    assert.ok(existsSync(resolve(raiz, artigo.fonte)), `Fonte inexistente: ${artigo.fonte}`);
  }
  for (const papel of ['ADMIN', 'BARBEIRO', 'CLIENTE'] as const) {
    const assuntos = ferramentaAjuda(papel).parameters.properties.assunto.enum;
    assert.equal(new Set(assuntos).size, assuntos.length);
    if (papel !== 'ADMIN') assert.ok(!assuntos.includes('CAIXA') && !assuntos.includes('ESTOQUE') && !assuntos.includes('CONFIGURACOES'));
  }
  const b = await db.barbearia.create({ data: { nome: 'Fixture ajuda IA', slug: randomUUID() } });
  const outra = await db.barbearia.create({ data: { nome: 'Outro tenant ajuda', slug: randomUUID() } });
  async function usuario(papel: ContextoIa['papel']) {
    return db.usuario.create({ data: { barbeariaId: b.id, nome: `Fixture ${papel}`, email: `${randomUUID()}@example.invalid`, senha: 'sem-login', papel } });
  }
  const admin = await usuario('ADMIN'), barbeiro = await usuario('BARBEIRO'), cliente = await usuario('CLIENTE');
  await db.barbeiro.create({ data: { usuarioId: barbeiro.id, barbeariaId: b.id, especialidades: [] } });
  const cadastro = await db.cliente.create({ data: { usuarioId: cliente.id } });
  await db.clienteBarbearia.create({ data: { clienteId: cadastro.id, barbeariaId: b.id } });
  const atores: ContextoIa[] = [
    { usuarioId: admin.id, barbeariaId: b.id, papel: 'ADMIN' },
    { usuarioId: barbeiro.id, barbeariaId: b.id, papel: 'BARBEIRO' },
    { usuarioId: cliente.id, barbeariaId: b.id, clienteId: cadastro.id, papel: 'CLIENTE' },
  ];
  for (const ator of atores) {
    const assunto = ator.papel === 'ADMIN' ? 'CAIXA' : ator.papel === 'BARBEIRO' ? 'COMISSOES' : 'AGENDA';
    const ajuda = await consultarAjuda(db, ator, { assunto });
    assert.ok(ajuda.link.startsWith(`/${ator.papel.toLowerCase()}/`));
    if (ator.papel === 'CLIENTE') assert.ok(ajuda.link.includes(b.id));
    assert.match(ajuda.limites.join(' '), /somente a pessoa/);
    await assert.rejects(consultarAjuda(db, { ...ator, barbeariaId: outra.id }, { assunto }), /Acesso/);
    await assert.rejects(consultarAjuda(db, ator, { assunto, barbeariaId: outra.id }), /inválido/);
    if (ator.papel !== 'ADMIN') await assert.rejects(consultarAjuda(db, ator, { assunto: 'CAIXA' }), /perfil/);
    let chamadas = 0;
    const resultado = await responderTextoOpenAI('Onde encontro essa função e como uso?', {
      chave: 'fixture', modelo: 'fixture', ajuda: { ferramenta: ferramentaAjuda(ator.papel), consultar: (args, signal) => consultarAjuda(db, ator, args, signal) },
    }, new AbortController().signal, async (_url, init) => {
      chamadas++;
      const body = JSON.parse(String(init?.body));
      assert.equal(body.tools.length, 1); assert.equal(body.tools[0].name, 'consultar_ajuda_sistema');
      assert.match(body.instructions, /não invente telas/);
      if (chamadas === 1) return new Response(JSON.stringify({ id: randomUUID(), status: 'completed', usage: { input_tokens: 100, output_tokens: 10 }, output: [{ type: 'function_call', name: 'consultar_ajuda_sistema', call_id: 'ajuda', arguments: JSON.stringify({ assunto }) }] }));
      const retorno = JSON.parse(body.input.at(-1).output);
      assert.equal(retorno.link, ajuda.link); assert.ok(!('fonte' in retorno)); assert.equal(body.tool_choice, 'none');
      return new Response(JSON.stringify({ id: randomUUID(), status: 'completed', usage: { input_tokens: 120, output_tokens: 20 }, output: [{ type: 'message', content: [{ type: 'output_text', text: retorno.link }] }] }));
    });
    assert.equal(chamadas, 2); assert.equal(resultado.tokensEntrada, 220); assert.equal(resultado.texto, ajuda.link);
    await db.usuario.update({ where: { id: ator.usuarioId }, data: { papel: ator.papel === 'CLIENTE' ? 'BARBEIRO' : 'CLIENTE' } });
    await assert.rejects(consultarAjuda(db, ator, { assunto }), /Acesso/);
  }
  console.log(`IA ajuda: ${guiaSistema.length} artigos com rotas/fontes reais; perfis, vínculos, revogação, escopo e adapter passaram sem OpenAI real.`);
}
main().finally(() => db.$disconnect()).catch(e => { console.error(e); process.exitCode = 1; });
