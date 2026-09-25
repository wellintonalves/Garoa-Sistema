import assert from 'node:assert/strict';
import { distribuirPagamentos } from '../../frontend/src/utils/distribuicaoPagamento';
import { periodoProducao } from '../../frontend/src/utils/periodoProducao';
import { preencherDiasProducao, agruparProducaoHoraria, chaveHoraProducao, totalizarRegistros, type RegistroProducao } from '../../frontend/src/utils/producaoSerie';

const queries: any[] = [];
(globalThis as any).prisma = { $extends: () => ({
  barbeiro: { findMany: async (q: any) => { queries.push(q); return []; } },
  lancamentoFinanceiro: { findMany: async (q: any) => { queries.push(q); return []; } },
}) };

async function main() {
  const pagos = [{id:'p',formaPagamento:'PIX',produzido:10.01},{id:'c',formaPagamento:'CARTAO_CREDITO',produzido:20},{id:'d',formaPagamento:'CARTAO_DEBITO',produzido:30},{id:'o',formaPagamento:'OUTRO',produzido:39.99}];
  const distribuicao = distribuirPagamentos([...pagos,pagos[0]]);
  assert.equal(distribuicao.find(p=>p.chave==='CARTAO')?.valor,50);
  assert.equal(distribuicao.find(p=>p.chave==='CARTAO')?.percentual,50);
  assert.equal(distribuicao.find(p=>p.chave==='OUTRO')?.valor,39.99);
  assert.equal(distribuicao.reduce((s,p)=>s+p.valor,0),100);
  assert.equal(distribuicao.reduce((s,p)=>s+p.percentual,0),100);
  assert.ok(distribuirPagamentos([]).every(p=>p.percentual===0 && p.valor===0));
  const { montarProducao, validarPeriodoProducao, obterProducaoBarbeiros, formasDaProducao } = await import('../src/services/producaoBarbeiro.service');
  const barbeiros = [{ id: 'b', usuario: { nome: 'Demo' } }];
  const linha: any = { id: '1', barbeariaId: 'demo', barbeiroId: 'b', data: new Date('2026-09-02T02:59:00Z'),
    valor: 60, valorComissao: 30, valorLiquido: 30, percentualComissao: 50, baseComissaoAplicada: 'VALOR_BRUTO', formaPagamento: 'PIX',
    agendamentoId: 'a', itens: [], servico: { nome: 'Nome atual', barbeariaId: 'demo' },
    agendamento: { barbeariaId: 'demo', barbeiroId: 'b', status: 'CONCLUIDO', dataHora: new Date('2026-09-01T13:00:00Z'),
      valorBruto: 60, valorDesconto: 0, servicosIds: ['s1','s2'], itens: [{ nome: 'Corte histórico', preco: 40, barbeariaId: 'demo' }, { nome: 'Barba histórica', preco: 20, barbeariaId: 'demo' }], _count: { lancamentos: 1 } } };
  const montar = (linhas: any[]) => montarProducao(linhas, barbeiros, 'demo')[0];
  let r = montar([linha]);
  assert.equal(r.produzido, 60); assert.equal(r.comissao, 30); assert.equal(r.atendimentos, 1);
  assert.equal(r.registros[0].dia, '2026-09-01');
  assert.deepEqual(r.registros[0].servicos, ['Corte histórico', 'Barba histórica']);
  r = montar([{ ...linha, valor: 50, valorLiquido: 20, agendamento: { ...linha.agendamento, valorDesconto: 10 } }]);
  assert.equal(r.comissao, 30, 'preserva comissão bruta histórica após desconto'); assert.equal(r.registros[0].aviso, null);
  r = montar([{ ...linha, percentualComissao: null, baseComissaoAplicada: null }]);
  assert.equal(r.comissao, 30); assert.match(r.registros[0].aviso!, /histórica/);
  r = montar([{ ...linha, valorComissao: 60, valorLiquido: 0, percentualComissao: 100 }]);
  assert.equal(r.liquido, 0);
  for (const status of ['CANCELADO', 'AGUARDANDO', 'CONFIRMADO']) {
    r = montar([{ ...linha, agendamento: { ...linha.agendamento, status } }]); assert.equal(r.produzido, 0); assert.equal(r.ignorados, 1);
  }
  r = montar([{ ...linha, agendamento: { ...linha.agendamento, _count: { lancamentos: 2 } } }, { ...linha, id: '2', agendamento: { ...linha.agendamento, _count: { lancamentos: 2 } } }]);
  assert.equal(r.produzido, 0); assert.equal(r.ignorados, 2);
  assert.equal(montar([{ ...linha, valorComissao: null }]).ignorados, 1);
  assert.deepEqual(montar([{ ...linha, valorComissao: null }]).diasIgnorados,[{dia:'2026-09-01',quantidade:1}]);
  assert.equal(montar([{ ...linha, valorLiquido: 90 }]).ignorados, 1);
  assert.equal(montar([{ ...linha, barbeariaId: 'outra' }]).registros.length, 0);
  assert.equal(montar([{ ...linha, agendamento: { ...linha.agendamento, barbeariaId: 'outra' } }]).registros.length, 0);
  assert.equal(montar([{ ...linha, agendamento: { ...linha.agendamento, barbeiroId: 'outro' } }]).registros.length, 0);
  assert.equal(montar([{ ...linha, agendamento: { ...linha.agendamento, itens: [{ nome: 'Privado', preco: 60, barbeariaId: 'outra' }] } }]).registros.length, 0);
  assert.equal(montar([{ ...linha, agendamento: null, agendamentoId: null, itens: [], servico: { nome: 'Privado', barbeariaId: 'outra' } }]).registros[0].servicos.includes('Privado'), false);
  r = montar([{ ...linha, agendamentoId: null, agendamento: null }]); assert.equal(r.atendimentos, 0); assert.equal(r.manuais, 1);
  assert.deepEqual(periodoProducao('semana', '2026-09-27', '', ''), { inicio: '2026-09-21', fim: '2026-09-27' });
  assert.deepEqual(periodoProducao('mes', '2024-02-15', '', ''), { inicio: '2024-02-01', fim: '2024-02-29' });
  assert.deepEqual(periodoProducao('dia', '2026-09-25', '', ''), { inicio: '2026-09-25', fim: '2026-09-25' });
  for (const [inicio, fim] of [['2026-02-30','2026-03-01'], ['2026-09-02','2026-09-01'], ['',''], ['2026-01-01','2026-09-25']]) assert.throws(()=>validarPeriodoProducao(inicio,fim));
  await assert.rejects(()=>obterProducaoBarbeiros('', '2026-09-01','2026-09-25'));
  await obterProducaoBarbeiros('demo', '2026-09-01','2026-09-25');
  assert.equal(queries.length,2); for (const q of queries) assert.equal(q.where.barbeariaId,'demo');
  const financeiro = queries.find(q=>q.where.data);
  assert.equal(financeiro.where.tipo,'ENTRADA'); assert.equal(financeiro.where.categoria.not,'Venda de Produto');
  assert.equal(financeiro.where.data.gte.toISOString(),'2026-09-01T03:00:00.000Z');
  assert.equal(financeiro.where.data.lte.toISOString(),'2026-09-26T02:59:59.999Z');
  assert.equal(financeiro.select.cliente, undefined, 'não expõe cliente');
  assert.equal(formasDaProducao('TODOS'), undefined);
  assert.deepEqual(formasDaProducao('CARTAO'), ['CARTAO_DEBITO', 'CARTAO_CREDITO']);
  for (const forma of ['PIX', 'DINHEIRO', 'CARTAO_DEBITO', 'CARTAO_CREDITO']) {
    assert.deepEqual(formasDaProducao(forma), [forma]);
    queries.length = 0;
    await obterProducaoBarbeiros('demo','2026-09-01','2026-09-25',{ pagamento: forma });
    const q = queries.find(q=>q.where.data);
    assert.deepEqual(q.where.formaPagamento.in,[forma]); assert.equal(q.where.barbeariaId,'demo');
  }
  await assert.rejects(()=>obterProducaoBarbeiros('demo','2026-09-01','2026-09-25',{pagamento:'BOLETO'}), /forma de pagamento/);
  queries.length = 0;
  await assert.rejects(()=>obterProducaoBarbeiros('demo','2026-09-01','2026-09-25',{pagamento:'CARTAO',barbeiroId:'outra-barbearia'}), /não encontrado/);
  assert.equal(queries.find(q=>q.where.data).where.barbeiroId,'outra-barbearia');
  assert.equal(queries.find(q=>!q.where.data).where.id,'outra-barbearia');
  assert.ok(queries.every(q=>q.where.barbeariaId==='demo'));
  // Mesmo se o filtro só retornar a parcela Pix, não atribui a ela o total de um atendimento duplicado/misto sem rateio registrado.
  assert.equal(montar([{...linha,agendamento:{...linha.agendamento,_count:{lancamentos:2}}}]).ignorados,1);
  const serie = preencherDiasProducao([{dia:'2026-09-02',produzido:50,comissao:30}], '2026-09-01','2026-09-03');
  assert.deepEqual(serie.map(d=>d.produzido),[0,50,0]);
  assert.equal(serie.reduce((s,d)=>s+d.comissao,0),30,'gráfico preserva comissão histórica com desconto');
  const horario = (id: string, inicio: string | null, origem: 'MANUAL' | 'ATENDIMENTO' = 'ATENDIMENTO'): RegistroProducao => ({id,dia:'2026-09-25',dataAtendimento:inicio,origem,produzido:50,comissao:20,liquido:30});
  assert.equal(chaveHoraProducao(horario('1','2026-09-25T03:00:00Z'),'2026-09-25'),'00');
  assert.equal(chaveHoraProducao(horario('1','2026-09-26T02:59:59Z'),'2026-09-25'),'23');
  assert.equal(chaveHoraProducao(horario('1','2026-09-25T02:59:59Z'),'2026-09-25'),'outra-data');
  assert.equal(chaveHoraProducao(horario('1','2026-09-25T12:59:59Z'),'2026-09-25'),'09');
  assert.equal(chaveHoraProducao(horario('1','2026-09-25T13:00:00Z'),'2026-09-25'),'10');
  assert.equal(chaveHoraProducao(horario('1','inválido'),'2026-09-25'),'sem-horario');
  assert.equal(chaveHoraProducao(horario('1','2026-09-25T13:00:00Z','MANUAL'),'2026-09-25'),'sem-horario');
  const registrosHora = [horario('1','2026-09-25T12:30:00Z'),horario('2','2026-09-25T12:59:59Z'),horario('3','2026-09-25T13:00:00Z'),horario('4',null,'MANUAL'),horario('5','2026-09-24T13:00:00Z')];
  const horas = agruparProducaoHoraria([...registrosHora,registrosHora[0]],'2026-09-25');
  assert.equal(horas.length,26);
  assert.equal(horas.find(h=>h.chave==='09')?.produzido,100);
  assert.equal(horas.find(h=>h.chave==='10')?.atendimentos,1);
  assert.equal(horas.reduce((s,h)=>s+h.produzido,0),totalizarRegistros(registrosHora).produzido);
  assert.equal(horas.reduce((s,h)=>s+h.comissao,0),100);
  assert.equal(horas.reduce((s,h)=>s+h.ids.length,0),5,'sem duplicar nem dividir serviço por duração');
  console.log('PASS produção: datas, semana, mês, desconto, combo, comissão histórica, duplicação, cancelamento, incompletos e isolamento.');
}
main().catch(e=>{ console.error(e); process.exitCode=1; });
