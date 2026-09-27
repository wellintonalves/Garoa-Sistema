import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { consultarComissoes, ferramentaComissoes, pedeDadosComissao } from '../src/services/ia/comissoes';
import { consultarAjuda, ferramentaAjuda } from '../src/services/ia/ajudaSistema';
import { responderTextoOpenAI, ConfigTextoIa } from '../src/services/ia/openaiTexto';
import { conversarIa } from '../src/services/ia/conversa';
import { calcularFimCiclo } from '../src/domain/assinatura/regrasAssinatura';
import { ContextoIa } from '../src/services/ia/cotas';
const url = process.env.IA_TEST_DATABASE_URL;
if (!url || new URL(url).hostname !== '127.0.0.1' || new URL(url).pathname !== '/valen_ia_test') throw new Error('Somente banco local de teste.');
const db = new PrismaClient({ datasourceUrl: url });
async function fixture(): Promise<ContextoIa> {
  const b = await db.barbearia.create({ data: { nome:'Fixture comissão IA', slug:randomUUID(), legadoAssinatura:false } });
  const u = await db.usuario.create({ data:{barbeariaId:b.id,papel:'ADMIN',nome:'Admin fixture',email:randomUUID()+'@example.invalid',senha:'sem-login'} });
  const inicio = new Date(Date.now()-1000);
  await db.assinaturaSaas.create({data:{barbeariaId:b.id,plano:'BASICO',periodicidade:'MENSAL',precoCicloCentavos:1,status:'ATIVA',cicloInicio:inicio,cicloFim:calcularFimCiclo(inicio,'MENSAL')}});
  return {barbeariaId:b.id,usuarioId:u.id,papel:'ADMIN'};
}
async function main() {
  for(const q of ['qual era a porcentagem dos barbeiros','Qual a comissão está registrada para os barbeiros?','Qual a porcentagem/comissão de cada barbeiro?','quanto Ana ganha de comissão?','Como está a comissão da Ana?']) assert.equal(pedeDadosComissao(q),true,q);
  for(const q of ['onde vejo comissão?','como configuro comissão?','como eu faço para alterar comissão?','quanto ganhou de comissão este mês?','Qual o saldo de comissão?','quanto foi pago de comissão?']) assert.equal(pedeDadosComissao(q),false,q);
  const a=await fixture(), b=await fixture();
  assert.equal((await consultarComissoes(db,a,{barbeiro:null})).estado,'SEM_REGISTROS');
  async function profissional(c:ContextoIa,nome:string,taxa:number,ativo=true) {
    const u=await db.usuario.create({data:{barbeariaId:c.barbeariaId,papel:'BARBEIRO',nome,email:randomUUID()+'@example.invalid',senha:'sem-login'}});
    const p=await db.barbeiro.create({data:{barbeariaId:c.barbeariaId,usuarioId:u.id,especialidades:[],comissaoPercent:taxa,ativo}});
    return {id:p.id,contexto:{...c,usuarioId:u.id,papel:'BARBEIRO' as const}};
  }
  const ana=await profissional(a,'Ana',0), bia=await profissional(a,'Bia',37.5,false);
  await profissional(b,'Outro tenant',99);
  await db.servico.create({data:{barbeariaId:a.barbeariaId,nome:'Corte fixture',preco:50,duracaoMinutos:30,comissaoPercent:88}});
  const semBase=await consultarComissoes(db,a,{barbeiro:null});
  assert.equal(semBase.baseServicos,null); assert.equal(semBase.profissionais.find(p=>p.nome==='Ana')?.percentualServicos,0);
  assert.equal(semBase.profissionais.find(p=>p.nome==='Bia')?.percentualServicos,37.5);
  assert.equal(semBase.produtos.percentual,null); assert.equal(semBase.produtos.comissaoAplicadaNaVenda,false);
  assert.ok(!JSON.stringify(semBase).includes('Outro tenant')); assert.ok(!JSON.stringify(semBase.profissionais).includes('88'));
  assert.equal(semBase.profissionais.find(p=>p.nome==='Bia')?.ativo,false);
  await db.configuracao.create({data:{barbeariaId:a.barbeariaId,baseCalculoComissao:'VALOR_BRUTO'}});
  assert.equal((await consultarComissoes(db,a,{barbeiro:'Ana'})).baseServicos,'VALOR_BRUTO');
  await db.configuracao.update({where:{barbeariaId:a.barbeariaId},data:{baseCalculoComissao:'VALOR_LIQUIDO'}});
  assert.equal((await consultarComissoes(db,a,{barbeiro:'Ana'})).baseServicos,'VALOR_LIQUIDO');
  assert.equal((await consultarComissoes(db,ana.contexto,{barbeiro:null})).profissionais.length,1);
  await assert.rejects(consultarComissoes(db,ana.contexto,{barbeiro:'Bia'}),/própria/);
  await assert.rejects(consultarComissoes(db,bia.contexto,{barbeiro:null}),/própria/);
  await assert.rejects(consultarComissoes(db,{...a,papel:'CLIENTE'},{barbeiro:null}),/acesso/);
  await assert.rejects(consultarComissoes(db,{...a,barbeariaId:b.barbeariaId},{barbeiro:null}),/Acesso/);
  await assert.rejects(consultarComissoes(db,a,{barbeiro:null,barbeariaId:b.barbeariaId}),/nome válido/);
  await profissional(a,'Ana',22);
  await assert.rejects(consultarComissoes(db,a,{barbeiro:'Ana'}),/mesmo nome/);
  assert.equal((await consultarComissoes(db,ana.contexto,{barbeiro:'Ana'})).profissionais[0].percentualServicos,0);
  await db.barbeiro.update({where:{id:bia.id},data:{comissaoPercent:101}});
  assert.equal((await consultarComissoes(db,a,{barbeiro:'Bia'})).profissionais[0].percentualServicos,null);
  await db.barbeiro.update({where:{id:bia.id},data:{comissaoPercent:37.5}});
  const cfg:ConfigTextoIa={chave:'fixture',modelo:'fixture',consultarComissoes:(args,signal)=>consultarComissoes(db,a,args,signal),ajuda:{ferramenta:ferramentaAjuda('ADMIN'),consultar:(args,signal)=>consultarAjuda(db,a,args,signal)}};
  for(const [pergunta,nomeTool,args] of [['qual era a porcentagem dos barbeiros',ferramentaComissoes.name,{barbeiro:null}],['onde vejo comissão?','consultar_ajuda_sistema',{assunto:'COMISSOES'}],['como configuro comissão?','consultar_ajuda_sistema',{assunto:'COMISSOES'}]] as const){
    let n=0;
    const result=await responderTextoOpenAI(pergunta,cfg,new AbortController().signal,async(_url,init)=>{
      const body=JSON.parse(String(init?.body)); n++;
      if(n===1){assert.deepEqual(body.tool_choice,{type:'function',name:nomeTool}); return new Response(JSON.stringify({id:randomUUID(),status:'completed',usage:{input_tokens:20,output_tokens:10},output:[{type:'function_call',name:nomeTool,call_id:'call',arguments:JSON.stringify(args)}]}));}
      const dados=JSON.parse(body.input.at(-1).output);
      if(nomeTool===ferramentaComissoes.name){assert.equal(dados.estado,'DADOS');assert.equal(dados.profissionais.find((p:any)=>p.nome==='Bia').percentualServicos,37.5);}
      else assert.equal(dados.titulo,'Comissões');
      return new Response(JSON.stringify({id:randomUUID(),status:'completed',usage:{input_tokens:30,output_tokens:10},output:[{type:'message',content:[{type:'output_text',text:nomeTool===ferramentaComissoes.name?'Bia: 37,5% em serviços, taxa atual.':'Abra Barbeiros para conferir o percentual.'}]}]}));
    }); assert.equal(result.concluida,true); assert.equal(result.tokensEntrada,50); assert.equal(n,2);
  }
  const env={IA_ENABLED:'true',IA_PERSISTENCIA_ENABLED:'true',OPENAI_API_KEY:'fixture',OPENAI_TEXT_MODEL:'fixture',IA_CREDITOS_BASICO:'10000',IA_CREDITOS_PRO:'10000',IA_CUSTO_CREDITO_MICROUSD:'1',IA_TARIFA_ENTRADA_MICROUSD_MILHAO:'2',IA_TARIFA_SAIDA_MICROUSD_MILHAO:'10',IA_TARIFA_VERSAO:'fixture',IA_POLITICA_VERSAO:'fixture',IA_CONTAGEM_TEXTO:'RESPOSTA_CONCLUIDA',IA_RESULTADO_CHAVE_BASE64:randomBytes(32).toString('base64'),IA_RESULTADO_RETENCAO_HORAS:'1'};
  const conversaId=randomUUID();
  const resposta=(texto:string)=>({texto,concluida:true,respostaId:randomUUID(),tokensEntrada:10,tokensSaida:10});
  await conversarIa(db,a,randomUUID(),'qual era a porcentagem dos barbeiros',env,async(_q,c)=>{assert.ok(c.consultarComissoes);return resposta('Bia tem 37,5% em serviços.');},conversaId);
  await conversarIa(db,a,randomUUID(),'E a Bia?',env,async(_q,c)=>{assert.equal(c.historico?.at(-1)?.usuario,'qual era a porcentagem dos barbeiros');const d:any=await c.consultarComissoes!({barbeiro:'Bia'},new AbortController().signal);assert.equal(d.profissionais[0].percentualServicos,37.5);return resposta('37,5% é a taxa atual da Bia.');},conversaId);
  await db.usuario.update({where:{id:a.usuarioId},data:{papel:'CLIENTE'}});
  await assert.rejects(consultarComissoes(db,a,{barbeiro:null}),/Acesso/);
  await db.barbeiro.update({where:{id:ana.id},data:{ativo:false}});
  await assert.rejects(consultarComissoes(db,ana.contexto,{barbeiro:null}),/própria/);
  console.log('IA comissões: taxas atuais, zero/ausente/inválido, vazio, base, produto sem regra, homônimos, tenant, perfis, revogação, dado vs ajuda e contexto passaram sem OpenAI real.');
}
main().finally(()=>db.$disconnect()).catch(e=>{console.error(e);process.exitCode=1;});
