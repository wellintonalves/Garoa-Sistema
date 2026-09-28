import assert from 'node:assert/strict';
import { TransporteVoz, DependenciasVoz } from '../src/services/ia/transporteVoz';
import { VOZ_LOCAL, ENVELOPE_VOZ_MICROUSD, custoRespostaVoz } from '../src/services/ia/limitesVoz';
import { statusVozLocal, criarTicketVozLocal } from '../src/services/ia/vozLocal';

globalThis.fetch = async () => { throw new Error('Teste não permite rede.'); };
const usage = { input_tokens: 110, output_tokens: 30, input_token_details: { text_tokens: 100, audio_tokens: 10, image_tokens: 0 }, output_token_details: { text_tokens: 10, audio_tokens: 20 } };
const session = { max_output_tokens: 256, truncation: { token_limits: { post_instructions: 1500 } }, audio: { input: { turn_detection: { create_response: false }, transcription: null }, output: { voice: 'marin' } } };
function fixture(overrides: Partial<DependenciasVoz> = {}) {
  let agora = 100000, fechamentos = 0;
  const enviados: Record<string, any>[] = [], clientes: Record<string, any>[] = [], usos: unknown[] = [];
  const c = new TransporteVoz({ agora: () => agora, enviarProvedor: e => enviados.push(e), enviarCliente: e => clientes.push(e),
    fecharProvedor: () => fechamentos++, autorizar: async () => {}, consultar: async () => ({ percentual: 37.5 }), inicio: async () => {},
    finalizar: async u => { usos.push(u); }, ...overrides }, session, 190000);
  return { c, enviados, clientes, usos, avancar: (n: number) => { agora += n; }, fechamentos: () => fechamentos };
}
async function pronta(f: ReturnType<typeof fixture>) {
  f.c.abrir(); await f.c.evento({ type: 'session.created', session: { id: 'sessao-fixture' } });
  await f.c.evento({ type: 'session.updated', session });
}
const done = (id: string, output: unknown[] = []) => ({ type: 'response.done', response: { id, status: 'completed', usage, output } });
async function main() {
  assert.equal(ENVELOPE_VOZ_MICROUSD, 29720); assert.ok(ENVELOPE_VOZ_MICROUSD < VOZ_LOCAL.reservaMicrousd);
  assert.equal(custoRespostaVoz(usage), 584);
  assert.throws(() => custoRespostaVoz({ ...usage, input_tokens: 1 }));
  assert.throws(() => custoRespostaVoz({ ...usage, output_token_details: { text_tokens: -1, audio_tokens: 31 } }));
  const ctx = { barbeariaId: 'b', usuarioId: 'u', papel: 'ADMIN' as const };
  assert.equal(statusVozLocal(ctx).vozDisponivel, false);
  await assert.rejects(criarTicketVozLocal(ctx, undefined), /não está disponível/);
  const normal = fixture(); await pronta(normal);
  normal.c.audio(Buffer.alloc(4096)); assert.equal(normal.enviados.at(-1)?.type, 'input_audio_buffer.append');
  for (let i = 0; i < 6; i++) {
    await normal.c.evento({ type: 'input_audio_buffer.committed' });
    await normal.c.evento(done(`r${i}`)); await normal.c.evento(done(`r${i}`));
  }
  normal.c.tick(); assert.equal(normal.fechamentos(), 0);
  normal.avancar(90000); normal.c.tick(); assert.equal(normal.fechamentos(), 1);
  await normal.c.fechou(1000); await normal.c.fechou(1000);
  assert.equal(normal.enviados.filter(e => e.type === 'response.create').length, 6);
  assert.equal(normal.usos.length, 1); assert.equal((normal.usos[0] as any).custo, 3504);
  assert.match(normal.clientes.at(-1)?.texto, /90 segundos/);
  const limiteCusto = fixture(); await pronta(limiteCusto);
  const caro = { input_tokens: 1500, output_tokens: 256,
    input_token_details: { text_tokens: 0, audio_tokens: 1500 },
    output_token_details: { text_tokens: 0, audio_tokens: 256 } };
  for (let i = 0; i < 3; i++) {
    await limiteCusto.c.evento({ type: 'input_audio_buffer.committed' });
    await limiteCusto.c.evento({ type: 'response.done', response: { id: `caro${i}`, status: 'completed', usage: caro, output: [] } });
  }
  await limiteCusto.c.evento({ type: 'input_audio_buffer.committed' });
  assert.equal(limiteCusto.enviados.filter(e => e.type === 'response.create').length, 3);
  assert.equal(limiteCusto.fechamentos(), 1);
  await limiteCusto.c.fechou(1000);
  assert.match(limiteCusto.clientes.at(-1)?.texto, /limite de custo/);
  assert.ok((limiteCusto.usos[0] as any).custo < VOZ_LOCAL.reservaMicrousd);
  const idle = fixture(); await pronta(idle); idle.avancar(45000); idle.c.tick();
  assert.ok(idle.clientes.some(e => e.tipo === 'aviso')); idle.avancar(15000); idle.c.tick(); assert.equal(idle.fechamentos(), 1);
  const ocupada = fixture(); await pronta(ocupada); await ocupada.c.evento({ type: 'input_audio_buffer.committed' });
  ocupada.avancar(61000); ocupada.c.tick(); assert.equal(ocupada.fechamentos(), 0);
  ocupada.avancar(30000); ocupada.c.tick(); assert.ok(ocupada.enviados.some(e => e.type === 'response.cancel'));
  await ocupada.c.fechou(1006); assert.equal((ocupada.usos[0] as any).confirmado, false);
  const tools = fixture(); await pronta(tools); await tools.c.evento({ type: 'input_audio_buffer.committed' });
  await tools.c.evento(done('tool', [{ type: 'function_call', name: 'consultar_regras_comissao', arguments: '{"barbeiro":null}', call_id: 'call' }]));
  assert.equal(tools.enviados.at(-1)?.response.tool_choice, 'none');
  assert.match(tools.enviados.find(e => e.type === 'conversation.item.create')!.item.output, /37.5/);
  const oversized = fixture({ consultar: async () => ({ texto: 'x'.repeat(1400) }) }); await pronta(oversized);
  await oversized.c.evento({ type: 'input_audio_buffer.committed' });
  await oversized.c.evento(done('tool2', [{ type: 'function_call', name: 'ajuda', arguments: '{}', call_id: 'c' }]));
  assert.match(oversized.enviados.find(e => e.type === 'conversation.item.create')!.item.output, /não cabe/);
  const revoked = fixture({ autorizar: async () => { throw new Error('Revogado'); } }); await pronta(revoked);
  await assert.rejects(revoked.c.evento({ type: 'input_audio_buffer.committed' }));
  assert.equal(revoked.enviados.filter(e => e.type === 'response.create').length, 0);
  const bad = fixture(); await assert.rejects(bad.c.evento({ type: 'session.updated', session: { ...session, max_output_tokens: 'inf' } }));
  const flood = fixture(); await pronta(flood); for (let i = 0; i < 20; i++) flood.c.audio(Buffer.alloc(9600));
  assert.ok(flood.fechamentos() > 0);
  const falando = fixture(); await pronta(falando); await falando.c.evento({ type: 'input_audio_buffer.speech_started' });
  falando.avancar(61000); falando.c.tick(); assert.equal(falando.fechamentos(), 0);
  await falando.c.evento({ type: 'input_audio_buffer.speech_stopped' }); falando.c.tick(); assert.equal(falando.fechamentos(), 0);
  const interrompida = fixture(); await pronta(interrompida); await interrompida.c.evento({ type: 'input_audio_buffer.committed' });
  interrompida.c.encerrar(); await interrompida.c.fechou(1000);
  assert.equal((interrompida.usos[0] as any).confirmado, false);
  console.log('Voz: limites, uso, inatividade, fechamento, revogação, ferramentas e configuração validados com transporte simulado. Nenhum áudio real gerado.');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
