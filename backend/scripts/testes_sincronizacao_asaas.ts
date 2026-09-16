import assert from 'node:assert/strict';
import { ProvedorAsaasSandbox } from '../src/integrations/assinaturas/provedorAssinatura';
const config = {apiKey:'$aact_hmlg_ficticia_teste',webhookToken:'token_teste_local_longo_32_caracteres',successUrl:'http://localhost/success',cancelUrl:'http://localhost/cancel',expiredUrl:'http://localhost/expired',userAgent:'TestesLocal',checkoutExpiracaoMinutos:30};
const entrada = {assinaturaExternaId:'sub-1',valorCentavos:6999,periodicidade:'MENSAL' as const,proximoVencimento:new Date('2026-10-15T15:00:00Z')};
const atual = {id:'sub-1',status:'ACTIVE',value:39.99,cycle:'MONTHLY',nextDueDate:'2026-10-15'};
const destino = {...atual,value:69.99};
function criar(respostas: Array<[number,any] | Error>) {
  const chamadas: Array<{url:string,method:string,body:any}> = [];
  const fake = async (url: any, init: any) => { chamadas.push({url:String(url),method:init.method,body:init.body ? JSON.parse(init.body):null}); const r=respostas.shift(); if(r instanceof Error)throw r; if(!r)throw new Error('Resposta não prevista');return new Response(JSON.stringify(r[1]),{status:r[0]}); };
  return {p:new ProvedorAsaasSandbox(config,fake as any),chamadas};
}
async function main(){
  const ok=criar([[200,atual],[200,destino],[200,destino],[200,destino]]);
  assert.equal((await ok.p.atualizarRecorrencia(entrada)).estado,'CONFIRMADO');
  assert.deepEqual(ok.chamadas.map(c=>c.method),['GET','PUT','GET']);
  assert.deepEqual(ok.chamadas[1].body,{value:69.99,cycle:'MONTHLY',nextDueDate:'2026-10-15',updatePendingPayments:true});
  assert.equal((await ok.p.atualizarRecorrencia(entrada)).estado,'CONFIRMADO');
  assert.equal(ok.chamadas.filter(c=>c.method==='PUT').length,1,'retry confirmado não repete PUT');
  const timeout=criar([[200,atual],new Error('timeout'),[200,destino]]);
  assert.equal((await timeout.p.atualizarRecorrencia(entrada)).estado,'PENDENTE');
  assert.equal((await timeout.p.atualizarRecorrencia(entrada)).estado,'CONFIRMADO');
  assert.equal(timeout.chamadas.filter(c=>c.method==='PUT').length,1,'timeout após alteração é reconciliado por GET');
  const falha=criar([[200,atual],[400,{errors:[]}]]);
  assert.equal((await falha.p.atualizarRecorrencia(entrada)).estado,'FALHA');
  const inconsistente=criar([[200,atual],[200,destino],[200,atual]]);
  assert.equal((await inconsistente.p.atualizarRecorrencia(entrada)).estado,'PENDENTE');
  const pagamento={id:'pay-1',subscription:'sub-1',status:'OVERDUE'};
  const id={cobrancaExternaId:'pay-1',assinaturaExternaId:'sub-1'};
  const pago=criar([[200,{...pagamento,status:'CONFIRMED'}]]);
  assert.equal((await pago.p.cancelarCobrancaPendente(id)).estado,'PAGA');
  assert.deepEqual(pago.chamadas.map(c=>c.method),['GET']);
  const outro=criar([[200,{...pagamento,subscription:'sub-other'}]]);
  assert.equal((await outro.p.cancelarCobrancaPendente(id)).estado,'PENDENTE');assert.equal(outro.chamadas.length,1);
  const excluir=criar([[200,pagamento],[200,{deleted:true}],[200,{...pagamento,deleted:true}],[200,{...pagamento,deleted:true}]]);
  assert.equal((await excluir.p.cancelarCobrancaPendente(id)).estado,'CONFIRMADO');
  assert.equal((await excluir.p.cancelarCobrancaPendente(id)).estado,'CONFIRMADO');
  assert.equal(excluir.chamadas.filter(c=>c.method==='DELETE').length,1);
  const incerto=criar([[200,pagamento],new Error('timeout'),[404,{}]]);
  assert.equal((await incerto.p.cancelarCobrancaPendente(id)).estado,'PENDENTE');
  assert.equal((await incerto.p.cancelarCobrancaPendente(id)).estado,'CONFIRMADO');
  assert.equal(incerto.chamadas.filter(c=>c.method==='DELETE').length,1);
  console.log('Sincronização Asaas: PUT verificado, reconciliação sem duplicação, estado indeterminado, vínculo e proteção de cobranças pagas passaram. Rede simulada.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
