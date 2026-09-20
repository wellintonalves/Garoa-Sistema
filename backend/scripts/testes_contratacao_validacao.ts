import assert from 'node:assert/strict';
process.env.NODE_ENV = 'test';
process.env.ASSINATURA_PRO_DISPONIVEL = 'true';
const rows: any[] = []; const mudancas: any[] = []; let chamadas = 0;
const matches = (r: any, w: any) => Object.entries(w).every(([k,v]) => v && typeof v === 'object' && 'in' in v ? (v as any).in.includes(r[k]) : r[k] === v);
const model = (list: any[]) => ({
  findFirst: async ({where}: any) => list.find(r => matches(r, where)) || null,
  findUnique: async ({where}: any) => list.find(r => matches(r, where)) || null,
  create: async ({data}: any) => { const r = { id: `r${list.length}`, checkoutExternoId: null, checkoutUrl: null, ...data }; list.push(r); return r; },
  update: async ({where,data}: any) => Object.assign(list.find(r => matches(r, where)), data),
  updateMany: async ({where,data}: any) => { const found=list.filter(r => matches(r,where)); found.forEach(r=>Object.assign(r,data)); return {count:found.length}; },
});
const db: any = { $queryRaw: async()=>[], $transaction:async(op:any)=>op(db), assinaturaSaas: model(rows), mudancaAssinatura: model(mudancas), usuario: { findFirst: async () => ({id:'admin'}) }, barbearia: { findUnique: async ({where}:any) => ({id:where.id, legadoAssinatura:true}) } };
(globalThis as any).prisma = { $extends: () => db };
db.eventoWebhookAsaas = { findMany: async () => [] };
async function main() {
  const { AssinaturaOperacionalService: s } = await import('../src/services/assinaturaOperacional.service');
  const user = {id:'admin',papel:'ADMIN',barbeariaId:'a'} as any;
  const data = { plano:'BASICO',periodicidade:'MENSAL',formasPagamento:['CREDIT_CARD'],termosVersao:'2026-09-15',ofertaVersao:'2026-09-15',aceite:true,chaveIdempotencia:'request-0001'} as any;
  let resposta: any = {estado:'FALHA', criacaoConfirmadamenteRecusada:true};
  const provider = {configurado:true, criarCheckoutAssinatura:async()=>{chamadas++;return resposta;}} as any;
  process.env.ASSINATURA_PRO_DISPONIVEL = 'false';
  await assert.rejects(s.iniciarContratacao(user,{...data,plano:'PRO'},provider), /Pró ainda não está disponível/);
  assert.equal(chamadas,0,'Pró indisponível não chama o provedor');
  process.env.ASSINATURA_PRO_DISPONIVEL = 'true';
  for (const patch of [{aceite:'true'}, {aceite:1}, {termosVersao:'old'}, {ofertaVersao:'arbitrary'}, {periodicidade:'SEMESTRAL'}, {plano:'ADMIN'}, {formasPagamento:'PIX'}, {formasPagamento:['PIX']}, {formasPagamento:['PIX','CREDIT_CARD']}]) {
    await assert.rejects(s.iniciarContratacao(user,{...data,...patch},provider));
  }
  assert.equal(rows.length,0); assert.equal(chamadas,0);
  await assert.rejects(s.iniciarContratacao(user,data,provider), /Confira os dados/);
  assert.equal(rows.length,1); assert.equal(rows[0].checkoutExternoId,null);
  resposta = {estado:'CRIADO',checkoutId:'external-1',checkoutUrl:'http://localhost/checkout'};
  await s.iniciarContratacao(user,data,provider);
  assert.equal(rows.length,1); assert.equal(chamadas,2);
  await s.iniciarContratacao(user,data,provider);
  await s.iniciarContratacao(user,{...data,chaveIdempotencia:'request-0002'},provider);
  assert.equal(chamadas,2,'retry não duplica checkout já criado');
  await assert.rejects(s.iniciarContratacao({...user,barbeariaId:'b'},data,provider), /Identificador/);
  rows[0].status='ATIVA';
  mudancas.push({id:'m1',assinaturaId:'another-tenant',chaveIdempotencia:'change-0001'});
  await assert.rejects(s.solicitarMudanca(user,{aceite:true,ofertaVersao:'2026-09-15',chaveIdempotencia:'change-0001'},provider), /Identificador/);
  await assert.rejects(s.solicitarMudanca(user,{aceite:'true',ofertaVersao:'2026-09-15',chaveIdempotencia:'change-0001'} as any,provider), /aceitar/);
  resposta={estado:'FALHA'};
  const outro={...user,barbeariaId:'c'};
  await assert.rejects(s.iniciarContratacao(outro,{...data,chaveIdempotencia:'request-0003'},provider), /reconciliação/);
  const antes=chamadas;
  await assert.rejects(s.iniciarContratacao(outro,{...data,chaveIdempotencia:'request-0003'},provider), /reconciliação/);
  await assert.rejects(s.iniciarContratacao(outro,{...data,chaveIdempotencia:'request-0004'},provider), /reconciliação/);
  assert.equal(chamadas,antes,'resultado indeterminado não pode criar outra cobrança');
  Object.assign(rows[0],{status:'ATIVA',plano:'BASICO',periodicidade:'MENSAL',cicloInicio:new Date('2026-09-01'),cicloFim:new Date('2026-10-01')});
  await assert.rejects(s.solicitarMudanca(user,{aceite:true,ofertaVersao:'2026-09-15',chaveIdempotencia:'combo-0001',planoDestino:'PRO',periodicidadeDestino:'ANUAL'} as any,provider), /separadas/);
  mudancas.push({id:'pending-other-key',assinaturaId:rows[0].id,status:'AGENDADA',chaveIdempotencia:'first-change'});
  await assert.rejects(s.solicitarMudanca(user,{aceite:true,ofertaVersao:'2026-09-15',chaveIdempotencia:'second-change',periodicidadeDestino:'ANUAL'} as any,provider), /mudança pendente/);
  assert.equal(mudancas.length,2,'segunda mudança não é criada');
  const ofertas: any[] = [];
  const provedorPro = {configurado:true, criarCheckoutAssinatura:async(entrada:any)=>{ofertas.push(entrada);return {estado:'CRIADO',checkoutId:`pro-${ofertas.length}`,checkoutUrl:'https://sandbox.asaas.com/checkout/teste'};}} as any;
  for (const periodo of ['MENSAL','ANUAL']) {
    await s.iniciarContratacao({...user,barbeariaId:`pro-${periodo}`},{...data,plano:'PRO',periodicidade:periodo,chaveIdempotencia:`pro-contratacao-${periodo}`},provedorPro);
  }
  assert.deepEqual(ofertas.map(o=>o.valorCentavos),[6999,69990],'Pró usa os preços aprovados nos dois períodos');
  assert.deepEqual(ofertas.map(o=>o.periodicidade),['MENSAL','ANUAL']);
  console.log('Contratação: aceite estrito, versões, enums, isolamento de idempotência, falha explícita/retry e ambiguidade sem duplicação passaram.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
