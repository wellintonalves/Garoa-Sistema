import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { GraficoProducao, dataCompletaProducao } from './GraficoProducao';
import { ArrowSquareOut, ArrowLeft, CaretLeft, CaretRight } from '@phosphor-icons/react';
import api from '../api/client';
import { SkeletonCard } from './Skeleton';
import { hojeBrasilia } from '../utils/datas';
import { distribuirPagamentos } from '../utils/distribuicaoPagamento';
import { chaveHoraProducao, totalizarRegistros } from '../utils/producaoSerie';
import { deslocarDia, periodoProducao, type PeriodoProducao } from '../utils/periodoProducao';
import './ProducaoBarbeiros.css';

interface Totais { produzido: number; comissao: number; liquido: number; atendimentos: number; manuais: number }
interface Registro {
  id: string; dia: string; dataAtendimento: string | null; origem: 'ATENDIMENTO' | 'MANUAL'; servicos: string[];
  produzido: number; comissao: number; liquido: number; percentual: number | null; base: string | null;
  desconto: number | null; formaPagamento: string; aviso: string | null;
}
export interface Producao extends Totais { id: string; nome: string; ignorados: number; diasIgnorados: { dia: string; quantidade: number }[]; dias: (Totais & { dia: string })[]; registros: Registro[] }
const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const data = (d: string) => new Date(`${d}T12:00:00-03:00`).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
const pagamentos: Record<string, string> = { TODOS: 'Todos', PIX: 'Pix', DINHEIRO: 'Dinheiro', CARTAO: 'Cartão (crédito e débito)', CARTAO_DEBITO: 'Cartão de débito', CARTAO_CREDITO: 'Cartão de crédito' };
const dataCivilValida = (valor: string) => /^\d{4}-\d{2}-\d{2}$/.test(valor) && !Number.isNaN(Date.parse(valor)) && new Date(`${valor}T12:00:00Z`).toISOString().slice(0,10) === valor;

export function ProducaoBarbeiros({ barbeiroId }: { barbeiroId?: string }) {
  const hoje = hojeBrasilia();
  const [params, setParams] = useSearchParams();
  const tipoParam = params.get('periodo');
  const tipo: PeriodoProducao = ['mes', 'semana', 'dia', 'intervalo'].includes(tipoParam ?? '') ? tipoParam as PeriodoProducao : 'mes';
  const referenciaParam = params.get('referencia') ?? hoje;
  const referencia = dataCivilValida(referenciaParam) ? referenciaParam : hoje;
  const inicio = params.get('inicio') ?? hoje.slice(0,7) + '-01';
  const fim = params.get('fim') ?? hoje;
  const pagamentoParam = params.get('pagamento') ?? 'TODOS';
  const pagamento = Object.hasOwn(pagamentos, pagamentoParam) ? pagamentoParam : 'TODOS';
  function alterar(valores: Record<string, string>) {
    const proximo = new URLSearchParams(params);
    for (const [chave, valor] of Object.entries(valores)) proximo.set(chave, valor);
    setParams(proximo);
  }
  const query = new URLSearchParams({ periodo: tipo, referencia, inicio, fim, pagamento }).toString();
  const [tentativa, setTentativa] = useState(0);
  const [resultado, setResultado] = useState<Producao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [horaSelecionada, setHoraSelecionada] = useState<string | null>(null);
  const periodo = periodoProducao(tipo, referencia, inicio, fim);
  const valido = dataCivilValida(periodo.inicio) && dataCivilValida(periodo.fim) && periodo.inicio <= periodo.fim;

  useEffect(() => {
    const controller = new AbortController();
    setErro(''); setResultado([]); setDiaSelecionado(null); setHoraSelecionada(null);
    if (!valido) { setCarregando(false); return () => controller.abort(); }
    setCarregando(true);
    api.get<{ barbeiros: Producao[] }>('/barbeiros/producao', { params: { inicio: periodo.inicio, fim: periodo.fim, pagamento, ...(barbeiroId ? { barbeiroId } : {}) }, signal: controller.signal })
      .then(res => { if (!controller.signal.aborted) setResultado(res.data.barbeiros ?? []); })
      .catch((e: unknown) => { if (!controller.signal.aborted) setErro(e instanceof Error ? e.message : 'Não foi possível carregar a produção.'); })
      .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
    return () => controller.abort();
  }, [periodo.inicio, periodo.fim, pagamento, barbeiroId, tentativa, valido]);

  const barbeiro = resultado.find(b => b.id === barbeiroId);
  const diaAtivo = periodo.inicio === periodo.fim ? periodo.inicio : diaSelecionado && diaSelecionado >= periodo.inicio && diaSelecionado <= periodo.fim ? diaSelecionado : null;
  const detalhes = (barbeiro?.registros ?? []).filter(r => (!diaAtivo || r.dia === diaAtivo) && (!horaSelecionada || (diaAtivo && chaveHoraProducao(r, diaAtivo) === horaSelecionada)));
  const distribuicao = distribuirPagamentos(detalhes);
  const resumo = diaAtivo ? totalizarRegistros(detalhes) : barbeiro;
  const pendentesNoDia = barbeiro?.diasIgnorados?.find(d => d.dia === diaAtivo)?.quantidade ?? 0;
  const semValoresConfiaveis = Boolean((diaAtivo ? pendentesNoDia : barbeiro?.ignorados) && !detalhes.length);
  const horaLabel = horaSelecionada === 'a-conferir' ? 'Registros fora do cálculo' : horaSelecionada === 'sem-horario' ? 'Sem horário de atendimento' : horaSelecionada === 'outra-data' ? 'Atendimento em outra data' : horaSelecionada ? `${horaSelecionada}h–${horaSelecionada}h59` : '';
  function focar(id: string) { requestAnimationFrame(() => { const el = document.getElementById(id); el?.focus({ preventScroll: true }); el?.scrollIntoView({ block: 'start' }); }); }
  function selecionarDia(dia: string) { setDiaSelecionado(dia); setHoraSelecionada(null); focar('resumo-selecao'); }
  function selecionarHora(hora: string) { setHoraSelecionada(hora); requestAnimationFrame(() => { const el = document.getElementById('atendimentos-expansivel') as HTMLDetailsElement | null; if (el) el.open = true; focar('servicos-do-dia'); }); }

  function navegar(direcao: number) {
    if (tipo === 'mes') {
      const d = new Date(`${referencia.slice(0, 7)}-01T12:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() + direcao);
      alterar({ referencia: d.toISOString().slice(0, 10) });
    } else alterar({ referencia: deslocarDia(referencia, direcao * (tipo === 'semana' ? 7 : 1)) });
  }

  return <section id="producao-barbeiros" className="producao card" aria-labelledby="producao-titulo" tabIndex={-1} onKeyDown={e => {
    if (!diaAtivo || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const alvo = e.target as HTMLElement;
    if (alvo.closest('input, select, textarea, [contenteditable]:not([contenteditable="false"]), [role="slider"], .evolucao')) return;
    e.preventDefault();
    e.currentTarget.focus({ preventScroll: true });
    alterar({ periodo: 'dia', referencia: deslocarDia(diaAtivo, e.key === 'ArrowLeft' ? -1 : 1) });
  }}>
    <header className="producao-cabecalho">
      <div className="min-w-0">{barbeiroId ? <><Link className="producao-voltar" to={`/admin/barbeiros?${query}#producao-barbeiros`}><ArrowLeft size={18} /> Voltar aos barbeiros</Link><h1 id="producao-titulo">{barbeiro ? `Produção de ${barbeiro.nome}` : 'Produção do barbeiro'}</h1><p>Produção, comissões e serviços realizados.</p></> : <><h2 id="producao-titulo">Produção e comissões</h2><p>Abra os detalhes de um barbeiro em uma nova aba.</p></>}</div>
      <div className="producao-periodos" aria-label="Período da produção">
        {(['dia', 'semana', 'mes', 'intervalo'] as const).map(t => <button key={t} type="button" aria-pressed={tipo === t && (t !== 'dia' || referencia === hoje)} onClick={() => alterar({ periodo: t, ...(t === 'dia' ? { referencia: hoje } : {}) })}>{({ mes: 'Mês', semana: 'Semana', dia: 'Hoje', intervalo: 'Personalizado' })[t]}</button>)}
      </div>
    </header>
    <div className="producao-filtros">
      {tipo === 'intervalo' ? <>
        <label>De<input type="date" className="ds-input" value={inicio} onChange={e => alterar({ inicio: e.target.value })} /></label>
        <label>Até<input type="date" className="ds-input" value={fim} onChange={e => alterar({ fim: e.target.value })} /></label>
      </> : <div className="producao-navegacao">
        <button type="button" onClick={() => navegar(-1)} aria-label="Período anterior"><CaretLeft size={18} /></button>
        <label>{tipo === 'mes' ? 'Mês de referência' : tipo === 'semana' ? 'Uma data da semana' : 'Data'}<input className="ds-input" type={tipo === 'mes' ? 'month' : 'date'} value={tipo === 'mes' ? referencia.slice(0, 7) : referencia} onChange={e => { if (e.target.value) alterar({ referencia: tipo === 'mes' ? `${e.target.value}-01` : e.target.value }); }} /></label>
        <button type="button" onClick={() => navegar(1)} aria-label="Próximo período"><CaretRight size={18} /></button>
      </div>}
      <label>Forma de pagamento<select aria-label="Forma de pagamento" className="ds-select" value={pagamento} onChange={e => alterar({ pagamento: e.target.value })}>{Object.entries(pagamentos).map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}</select></label>
    </div>
    {!valido ? <p role="alert">Informe a data inicial e a final, nessa ordem.</p> : carregando ? <div role="status" aria-label="Carregando produção" className="producao-cards"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div> : erro ?
      <div role="alert" className="producao-erro"><p>{erro}</p><button type="button" onClick={() => setTentativa(v => v + 1)}>Tentar novamente</button></div> : <>
        {!resultado.length && barbeiroId && <p>Não há dados deste barbeiro para exibir. Volte aos barbeiros ou tente outro período.</p>}
        {!resultado.length && !barbeiroId && <p>Cadastre um barbeiro para acompanhar a produção e as comissões.</p>}
        <div className="producao-cards">{!barbeiroId && (resultado ?? []).map(b => <Link key={b.id} className="producao-card" to={`/admin/barbeiros/${b.id}/producao?${query}`} target="_blank" rel="noopener noreferrer">
          <span className="producao-card-nome">{b.nome}<ArrowSquareOut size={18} aria-hidden="true" /></span>
          <span className="producao-par"><span>Valor dos serviços</span><strong>{moeda(b.produzido)}</strong></span>
          <span className="producao-par"><span>Comissão do barbeiro</span><strong>{moeda(b.comissao)}</strong></span>
          <span className="producao-card-rodape">{b.atendimentos} atendimento{b.atendimentos === 1 ? '' : 's'}{b.manuais > 0 ? ` · ${b.manuais} lançamento(s) manual(is)` : ''}<span className="sr-only">Abrir detalhes de {b.nome} em nova aba</span></span>
          {b.ignorados > 0 && <span>{b.ignorados} registro(s) precisam de conferência.</span>}
        </Link>)}</div>
        {barbeiro && <div id="producao-detalhes" className="producao-detalhes">
          {barbeiro.ignorados > 0 && <p role="status" className="producao-alerta">{barbeiro.ignorados} lançamento(s) fora dos totais: há dados incompletos, fechamento duplicado ou atendimento não concluído. Confira no Financeiro.</p>}
          <div className="diario-recorte" tabIndex={diaAtivo ? 0 : undefined} aria-label={diaAtivo ? 'Navegação diária. Use seta esquerda para o dia anterior e direita para o seguinte.' : undefined}><h2 id="resumo-selecao" tabIndex={-1}>{diaAtivo ? `${dataCompletaProducao(diaAtivo)}${horaLabel ? ' · ' + horaLabel : ''}` : 'Totais do período'}</h2><div>{horaSelecionada && <button type="button" onClick={() => { setHoraSelecionada(null); focar('resumo-selecao'); }}>Ver todas as horas do dia</button>}{diaSelecionado && tipo !== 'dia' && <button type="button" onClick={() => { setDiaSelecionado(null); setHoraSelecionada(null); focar('resumo-selecao'); }}>Voltar ao período completo</button>}</div></div>
          <div className="producao-totais" role="group" aria-label="Resumo da produção">{[['Produção total', resumo?.produzido ?? 0], ['Comissão do barbeiro', resumo?.comissao ?? 0], ['Líquido da barbearia', resumo?.liquido ?? 0], ['Atendimentos', resumo?.atendimentos ?? 0]].map(([label,valor]) => <div key={label}><span>{label}</span><strong>{semValoresConfiaveis ? 'A conferir' : label === 'Atendimentos' ? valor : moeda(Number(valor))}</strong></div>)}</div>
          {resumo && resumo.manuais > 0 && <p className="producao-definicao">Inclui {resumo.manuais} lançamento(s) manual(is) nos valores, sem contar como atendimento.</p>}
          {pendentesNoDia > 0 && <p className="producao-alerta">Este dia tem {pendentesNoDia} registro(s) fora do cálculo. Os valores e horários disponíveis não representam o dia completo.</p>}
          <GraficoProducao key={`${periodo.inicio}|${periodo.fim}|${pagamento}|${barbeiro.id}|${diaAtivo}`} dias={barbeiro.dias} registros={barbeiro.registros} diasIgnorados={barbeiro.diasIgnorados ?? []} inicio={periodo.inicio} fim={periodo.fim} diaSelecionado={diaAtivo} horaSelecionada={horaSelecionada} onSelecionarDia={selecionarDia} onSelecionarHora={selecionarHora} />
          <section className="producao-pagamentos" aria-labelledby="pagamentos-titulo"><h2 id="pagamentos-titulo">Formas de pagamento</h2>{pagamento !== 'TODOS' && <p>Filtro: {pagamentos[pagamento]}</p>}
            <ul>{distribuicao.map(p => <li key={p.chave} data-pagamento={p.chave}><div><span>{p.nome}</span><strong>{moeda(p.valor)}</strong><span>{p.percentual.toLocaleString('pt-BR', {maximumFractionDigits: 1})}%</span></div><div className="pagamento-trilho" aria-hidden="true"><i style={{width: `${p.percentual}%`}} /></div></li>)}</ul>
            {!detalhes.length && <p>Sem valores confirmados nesta seleção. Não há participação a calcular.</p>}
          </section>
          <details id="atendimentos-expansivel" className="producao-lista"><summary id="servicos-do-dia" tabIndex={0}>{diaAtivo ? `Serviços de ${data(diaAtivo)}${horaLabel ? ' · ' + horaLabel : ''}` : 'Detalhamento dos atendimentos'} <span>({detalhes.length})</span></summary>
            {!detalhes.length ? <p>Não há serviços com valores confirmados para os filtros e o dia selecionados.</p> : <ul>{(detalhes ?? []).map(r => <li key={r.id}>
              <div className="min-w-0"><p className="producao-servico">{(r.servicos ?? []).join(' + ')}</p>
                <p>{data(r.dia)} · {r.dataAtendimento ? `Atendimento ${new Date(r.dataAtendimento).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : 'Lançamento manual'} · {pagamentos[r.formaPagamento] ?? (r.formaPagamento || 'Não informado').replaceAll('_', ' ').toLocaleLowerCase('pt-BR')}</p>
                {r.desconto != null && r.desconto > 0 && <p>Desconto aplicado: {moeda(r.desconto)}</p>}
                <p>{r.percentual == null ? 'Percentual histórico não informado' : `${r.percentual}%${r.base === 'VALOR_BRUTO' ? ' sobre o valor antes dos descontos' : r.base === 'VALOR_LIQUIDO' ? ' sobre o valor após descontos' : ' · base histórica não informada'}`}</p>
                {r.aviso && <p className="producao-alerta">{r.aviso}</p>}
              </div>
              <div className="producao-valores"><span>Valor dos serviços <strong>{moeda(r.produzido)}</strong></span><span>Comissão do barbeiro <strong>{moeda(r.comissao)}</strong></span></div>
            </li>)}</ul>}
          </details>
        </div>}
      </>}
  </section>;
}
