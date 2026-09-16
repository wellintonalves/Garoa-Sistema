import assert from 'node:assert/strict';
import { criarProvedorAssinatura } from '../src/integrations/assinaturas/provedorAssinatura';

async function main() {
  let chamadas = 0;
  const mock: typeof fetch = async (url, init) => {
    chamadas++;
    assert.equal(new URL(String(url)).origin, 'https://api.asaas.com');
    assert.equal((init?.headers as Record<string,string>).access_token, '$aact_prod_fixture');
    if (String(url).endsWith('/myAccount/status')) return new Response(JSON.stringify({ id: 'account-fixture', general: 'APPROVED' }), { status: 200 });
    return new Response(JSON.stringify({id:'checkout-fixture',link:'https://www.asaas.com/checkoutSession/show/fixture'}), { status:200 });
  };
  const env = { NODE_ENV:'production', ASSINATURA_ASAAS_PRODUCTION_ENABLED:'true', ASAAS_ENV:'production', ASAAS_API_KEY:'$aact_prod_fixture', ASAAS_WEBHOOK_TOKEN:'token-de-teste-sem-valor-real-123456789', ASAAS_CHECKOUT_SUCCESS_URL:'https://valenbarber.com.br/admin/configuracoes',ASAAS_CHECKOUT_CANCEL_URL:'https://valenbarber.com.br/admin/configuracoes',ASAAS_CHECKOUT_EXPIRED_URL:'https://valenbarber.com.br/admin/configuracoes' };
  Object.assign(env, { ASAAS_ACCOUNT_ID: 'account-fixture', ASSINATURA_JOBS_ENABLED: 'true' });
  for (const override of [{ASAAS_ACCOUNT_ID:''},{ASSINATURA_JOBS_ENABLED:'false'},{ASAAS_ENV:'sandbox'},{ASAAS_API_KEY:'$aact_hmlg_fixture'},{NODE_ENV:'development'},{ASSINATURA_ASAAS_SANDBOX_ENABLED:'true'},{ASAAS_CHECKOUT_SUCCESS_URL:'http://localhost:5174'},{ASAAS_WEBHOOK_TOKEN:'curto'},{ASSINATURA_PROVEDOR:'fake'}]) assert.equal(criarProvedorAssinatura({...env,...override},mock).configurado,false);
  assert.equal(chamadas,0);
  const provider=criarProvedorAssinatura(env,mock);
  assert.equal(provider.ambiente,'PRODUCTION');
  const result=await provider.criarCheckoutAssinatura({referenciaExterna:'fixture',nomeItem:'Valen Básico',descricao:'Fixture',valorCentavos:3999,periodicidade:'MENSAL',primeiroVencimento:new Date('2026-09-22'),formasPagamento:['CREDIT_CARD']});
  assert.equal(result.estado,'CRIADO'); assert.equal(chamadas,2);
  const wrongHost=criarProvedorAssinatura(env,async(url)=>new Response(JSON.stringify(String(url).endsWith('/myAccount/status') ? {id:'account-fixture',general:'APPROVED'} : {id:'fixture',link:'https://sandbox.asaas.com/checkoutSession/show/fixture'}),{status:200}));
  assert.equal((await wrongHost.criarCheckoutAvulso({referenciaExterna:'fixture',nomeItem:'Upgrade',descricao:'Fixture',valorCentavos:100,formasPagamento:['CREDIT_CARD']})).estado,'FALHA');
  for (const conta of [{id:'outra-conta',general:'APPROVED'},{id:'account-fixture',general:'PENDING'}]) {
    const metodos: string[] = [];
    const recusado=criarProvedorAssinatura(env, async(_url,init)=>{metodos.push(init?.method || 'GET'); return new Response(JSON.stringify(conta),{status:200});});
    assert.equal((await recusado.criarCheckoutAvulso({referenciaExterna:'fixture',nomeItem:'Upgrade',descricao:'Fixture',valorCentavos:100,formasPagamento:['CREDIT_CARD']})).estado,'FALHA');
    assert.deepEqual(metodos,['GET'],'conta errada/não aprovada nunca recebe criação de cobrança');
  }
  console.log('PASS produção: conta autorizada e aprovada, jobs obrigatórios, ambientes e callbacks validados; sem rede real.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
