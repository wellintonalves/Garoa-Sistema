import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { referenciaTemporalIa, periodoRelativoIa } from '../src/services/ia/tempo';
import { carregarContexto, limitarContexto, CONTEXTO_MAX_BYTES } from '../src/services/ia/contextoConversa';
import { consultarAdmin } from '../src/services/ia/consultasAdmin';
import { conversarIa } from '../src/services/ia/conversa';
import { responderTextoOpenAI, ConfigTextoIa } from '../src/services/ia/openaiTexto';
import { calcularFimCiclo } from '../src/domain/assinatura/regrasAssinatura';
import { ContextoIa } from '../src/services/ia/cotas';

const url = process.env.IA_TEST_DATABASE_URL;
if (!url || new URL(url).hostname !== '127.0.0.1' || new URL(url).pathname !== '/valen_ia_test') throw new Error('Use somente o banco local de teste.');
const db = new PrismaClient({ datasourceUrl: url });
const chave = randomBytes(32);
const env = { IA_ENABLED: 'true', IA_PERSISTENCIA_ENABLED: 'true', OPENAI_API_KEY: 'fixture', OPENAI_TEXT_MODEL: 'fixture',
  IA_CREDITOS_BASICO: '10000', IA_CREDITOS_PRO: '10000', IA_CUSTO_CREDITO_MICROUSD: '1', IA_TARIFA_ENTRADA_MICROUSD_MILHAO: '2', IA_TARIFA_SAIDA_MICROUSD_MILHAO: '10', IA_TARIFA_VERSAO: 'fixture', IA_POLITICA_VERSAO: 'fixture', IA_CONTAGEM_TEXTO: 'RESPOSTA_CONCLUIDA', IA_RESULTADO_CHAVE_BASE64: chave.toString('base64'), IA_RESULTADO_RETENCAO_HORAS: '1' };
const resultado = (texto: string) => ({ texto, concluida: true, respostaId: randomUUID(), tokensEntrada: 20, tokensSaida: 10 });
const filtros = { consulta: 'RANKING_PRODUCAO', inicio: null, fim: null, periodoRelativo: 'ESTA_SEMANA', barbeiro: null, produto: null, pagamento: 'TODOS', criterio: 'RECEITA' };
async function fixture(): Promise<ContextoIa> {
  const b = await db.barbearia.create({ data: { nome: 'Fixture contexto IA', slug: randomUUID(), legadoAssinatura: false } });
  const u = await db.usuario.create({ data: { barbeariaId: b.id, nome: 'Admin fixture', email: `${randomUUID()}@example.invalid`, senha: 'sem-login', papel: 'ADMIN' } });
  const inicio = new Date(Date.now() - 1000);
  await db.assinaturaSaas.create({ data: { barbeariaId: b.id, plano: 'BASICO', periodicidade: 'MENSAL', precoCicloCentavos: 1, status: 'ATIVA', cicloInicio: inicio, cicloFim: calcularFimCiclo(inicio, 'MENSAL') } });
  return { barbeariaId: b.id, usuarioId: u.id, papel: 'ADMIN' };
}
async function main() {
  assert.equal(referenciaTemporalIa(new Date('2027-01-01T02:59:59Z')).inicioMes, '2026-12-01');
  assert.equal(referenciaTemporalIa(new Date('2027-01-01T03:00:00Z')).inicioMes, '2027-01-01');
  assert.equal(referenciaTemporalIa(new Date('2027-01-01T03:00:00Z')).inicioSemana, '2026-12-27');
  assert.equal(referenciaTemporalIa(new Date('2026-09-06T02:59:59Z')).inicioSemana, '2026-08-30');
  assert.equal(referenciaTemporalIa(new Date('2026-09-06T03:00:00Z')).inicioSemana, '2026-09-06');
  assert.equal(periodoRelativoIa('ESTE_MES', new Date('2024-02-29T12:00:00Z')).inicio, '2024-02-01');
  const agora = new Date('2026-09-09T15:00:00Z');
  const a = await fixture(), b = await fixture();
  async function barbeiro(c: ContextoIa, nome: string, ativo = true) {
    const u = await db.usuario.create({ data: { barbeariaId: c.barbeariaId, nome, email: `${randomUUID()}@example.invalid`, senha: 'sem-login', papel: 'BARBEIRO' } });
    return db.barbeiro.create({ data: { barbeariaId: c.barbeariaId, usuarioId: u.id, especialidades: [], ativo } });
  }
  const ana = await barbeiro(a, 'Ana'), bia = await barbeiro(a, 'Bia', false), externo = await barbeiro(b, 'Outro tenant');
  async function lancar(c: ContextoIa, barbeiroId: string, data: string, valor: number, categoria = 'Serviço prestado') {
    return db.lancamentoFinanceiro.create({ data: { barbeariaId: c.barbeariaId, barbeiroId, tipo: 'ENTRADA', categoria, data: new Date(data), formaPagamento: 'PIX', valor, valorComissao: valor / 2, valorLiquido: valor / 2, percentualComissao: 50, baseComissaoAplicada: 'VALOR_LIQUIDO' } });
  }
  await lancar(a, ana.id, '2026-09-07T15:00:00Z', 100);
  await lancar(a, bia.id, '2026-09-08T15:00:00Z', 200);
  await lancar(a, ana.id, '2026-09-09T16:00:00Z', 9999); // depois do instante confiável
  await lancar(a, ana.id, '2026-09-08T15:00:00Z', 9999, 'Venda de Produto');
  await lancar(b, externo.id, '2026-09-08T15:00:00Z', 9999);
  const consultar = (args: object = {}, clock = agora) => consultarAdmin(db, a, { ...filtros, ...args }, undefined, clock) as Promise<any>;
  const ranking = await consultar();
  assert.equal(ranking.estado, 'LIDER'); assert.equal(ranking.lideres[0].nome, 'Bia'); assert.equal(ranking.lideres[0].valorProduzido, '200.00');
  assert.equal(ranking.barbeirosComparados, 2); assert.equal(ranking.primeiraProducaoRegistrada, '2026-09-07');
  assert.equal(ranking.intervalo.inicioInclusivo, '2026-09-06T03:00:00.000Z'); assert.equal(ranking.intervalo.fimInclusivo, agora.toISOString());
  assert.ok(!JSON.stringify(ranking).includes('Outro tenant'));
  await lancar(a, ana.id, '2026-09-06T15:00:00Z', 100); // exceção real no domingo não é descartada
  const empate = await consultar(); assert.equal(empate.estado, 'EMPATE'); assert.equal(empate.lideres.length, 2); assert.equal(empate.primeiraProducaoRegistrada, '2026-09-06');
  const quantidade = await consultar({ criterio: 'QUANTIDADE' }); assert.equal(quantidade.lideres[0].nome, 'Ana');
  const vazio = await consultar({}, new Date('2026-09-13T12:00:00Z')); assert.equal(vazio.estado, 'SEM_DADOS'); assert.equal(vazio.lideres.length, 0);
  await assert.rejects(consultar({ barbeiro: 'Ana' }), /Filtros incompatíveis/);
  await assert.rejects(consultar({ inicio: '2026-01-01' }), /nulos/);

  const conversa = randomUUID(), pedido = randomUUID();
  await conversarIa(db, a, pedido, 'Qual barbeiro mais produziu este mês?', env, async () => resultado('Você quer considerar desde o dia primeiro?'), conversa);
  const salvo = await db.iaReserva.findFirstOrThrow({ where: { barbeariaId: a.barbeariaId, chaveIdempotencia: pedido } });
  assert.ok(!salvo.respostaCifrada!.includes('primeiro'));
  let chamadas = 0;
  const provedor = async (mensagem: string, config: ConfigTextoIa, signal: AbortSignal) => {
    assert.equal(mensagem, 'Sim, desde o dia primeiro'); assert.equal(config.historico?.length, 1);
    return responderTextoOpenAI(mensagem, config, signal, async (_url, init) => {
      chamadas++;
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body.input.slice(0, 3).map((i: any) => i.role), ['user', 'assistant', 'user']);
      assert.equal(body.input[0].content, 'Qual barbeiro mais produziu este mês?');
      assert.equal(body.input[1].content, 'Você quer considerar desde o dia primeiro?');
      assert.equal(body.input[2].content, 'Sim, desde o dia primeiro');
      assert.match(body.instructions, /ESTE_MES/); assert.match(body.instructions, /domingo/); assert.match(body.instructions, /não pergunte o nome/); assert.match(body.instructions, /não herde filtros/);
      if (chamadas === 1) return new Response(JSON.stringify({ id: randomUUID(), status: 'completed', usage: { input_tokens: 100, output_tokens: 20 }, output: [{ type: 'function_call', call_id: 'fixture-call', name: 'consultar_dados_administrativos', arguments: JSON.stringify({ ...filtros, periodoRelativo: 'ESTE_MES' }) }] }));
      assert.equal(body.tool_choice, 'none'); const report = JSON.parse(body.input.at(-1).output); assert.equal(report.filtros.barbeiro, null); assert.equal(report.filtros.inicio.endsWith('-01'), true);
      return new Response(JSON.stringify({ id: randomUUID(), status: 'completed', usage: { input_tokens: 150, output_tokens: 20 }, output: [{ type: 'message', content: [{ type: 'output_text', text: 'Ranking consultado no período confirmado.' }] }] }));
    });
  };
  const segundo = randomUUID();
  const resposta = await conversarIa(db, a, segundo, 'Sim, desde o dia primeiro', env, provedor, conversa);
  assert.equal(resposta.estado, 'CONCLUIDA'); assert.equal(chamadas, 2);
  assert.deepEqual(await conversarIa(db, a, segundo, 'Sim, desde o dia primeiro', env, provedor, conversa), resposta); assert.equal(chamadas, 2);
  await assert.rejects(conversarIa(db, a, segundo, 'Sim, desde o dia primeiro', env, provedor, randomUUID()), /outro pedido/);
  await conversarIa(db, a, randomUUID(), 'Quem é você?', env, async (_m, cfg) => { assert.equal(cfg.historico?.length, 0); return resultado('Sou Valéria.'); }, randomUUID());
  assert.equal((await carregarContexto(db, b, conversa, chave, new Date(Date.now()))).length, 0);
  const outro = await db.usuario.create({ data: { barbeariaId: a.barbeariaId, nome: 'Outro admin', email: `${randomUUID()}@example.invalid`, senha: 'sem-login', papel: 'ADMIN' } });
  assert.equal((await carregarContexto(db, { ...a, usuarioId: outro.id }, conversa, chave, new Date(Date.now()))).length, 0);
  assert.equal((await carregarContexto(db, { ...a, papel: 'BARBEIRO' }, conversa, chave, new Date(Date.now()))).length, 0);
  assert.equal((await carregarContexto(db, a, conversa, chave, new Date(Date.now() + 31 * 60000))).length, 0);
  const limitado = limitarContexto(Array.from({ length: 10 }, () => ({ usuario: 'a'.repeat(1500), assistente: 'b'.repeat(1500), criadoEm: new Date(Date.now()).toISOString() })), new Date(Date.now()));
  assert.ok(limitado.length <= 3); assert.ok(Buffer.byteLength(JSON.stringify(limitado)) <= CONTEXTO_MAX_BYTES);
  await db.usuario.update({ where: { id: a.usuarioId }, data: { papel: 'CLIENTE' } });
  await assert.rejects(conversarIa(db, a, randomUUID(), 'sim', env, async () => { throw new Error('Não pode chegar ao provedor'); }, conversa), /Acesso/);
  console.log('IA contexto: calendário/fuso, domingo, virada de mês/ano, ranking/empate/vazio, exceção de domingo, contexto cifrado, escopo por ator/tenant/conversa/papel, TTL, replay e revogação passaram sem OpenAI real.');
}
main().finally(() => db.$disconnect()).catch(e => { console.error(e); process.exitCode = 1; });
