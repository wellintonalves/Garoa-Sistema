import { useId, useState } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { hojeBrasilia } from '../utils/datas';
import { agruparProducaoHoraria, preencherDiasProducao, type DiaProducao, type RegistroProducao } from '../utils/producaoSerie';
export { preencherDiasProducao } from '../utils/producaoSerie';
const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const dataCompletaProducao = (dia: string) => new Date(`${dia}T12:00:00-03:00`).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
interface Props {
  dias: DiaProducao[]; registros: RegistroProducao[]; diasIgnorados: { dia: string; quantidade: number }[]; inicio: string; fim: string;
  diaSelecionado: string | null; horaSelecionada: string | null;
  onSelecionarDia: (dia: string) => void; onSelecionarHora: (hora: string) => void;
}
export function GraficoProducao({ dias, registros, diasIgnorados, inicio, fim, diaSelecionado, onSelecionarDia, onSelecionarHora }: Props) {
  const id = useId();
  const hoje = hojeBrasilia();
  const horas = diaSelecionado ? agruparProducaoHoraria(registros, diaSelecionado) : [];
  const itens = diaSelecionado ? horas.slice(0,24).map(h => ({ chave: h.chave, rotulo: `${h.chave}h`, completo: h.rotulo, produzido: h.produzido, comissao: h.comissao, atendimentos: h.atendimentos, manuais: h.manuais, pendentes: 0, desconhecido: false })) : preencherDiasProducao(dias, inicio, fim).map(d => {
    const pendentes = diasIgnorados.find(p => p.dia === d.dia)?.quantidade ?? 0;
    const existente = dias.some(p => p.dia === d.dia);
    return { chave: d.dia, rotulo: d.dia.slice(8) + '/' + d.dia.slice(5,7), completo: dataCompletaProducao(d.dia), produzido: d.produzido, comissao: d.comissao, atendimentos: d.atendimentos ?? 0, manuais: d.manuais ?? 0, pendentes, desconhecido: !existente && (pendentes > 0 || d.dia > hoje) };
  });
  const inicial = Math.max(0, itens.findLastIndex(i => i.produzido > 0));
  const [indice, setIndice] = useState(inicial);
  const [visivel, setVisivel] = useState(true);
  const atual = itens[Math.min(indice, itens.length - 1)];
  if (!atual) return <p>Não há datas válidas para mostrar a evolução.</p>;
  const escala = Math.ceil(Math.max(1, ...itens.map(i => i.produzido)) / 10) * 10;
  const x = (n: number) => itens.length === 1 ? 500 : 20 + n / (itens.length - 1) * 960;
  const y = (valor: number) => 200 - valor / escala * 180;
  const linha = itens.map((i,n) => i.desconhecido ? '' : `${n === 0 || itens[n-1].desconhecido ? 'M' : 'L'}${x(n)},${y(i.produzido)}`).join(' ');
  const mudar = (n: number) => { setIndice(Math.max(0, Math.min(itens.length-1, n))); setVisivel(true); };
  const abrir = () => diaSelecionado ? onSelecionarHora(atual.chave) : onSelecionarDia(atual.chave);
  return <section className="producao-grafico evolucao" aria-labelledby={`${id}-titulo`}>
    <header className="producao-cabecalho"><div className="min-w-0"><h2 id={`${id}-titulo`}>{diaSelecionado ? 'Produção por hora' : 'Evolução da produção'}</h2>{diaSelecionado && <p>{dataCompletaProducao(diaSelecionado)} · Horário de Brasília</p>}</div><span className="evolucao-serie"><i />Produção</span></header>
    <p id={`${id}-ajuda`} className="evolucao-ajuda">Passe o mouse, toque no gráfico ou use as setas do teclado para consultar {diaSelecionado ? 'uma hora' : 'um dia'}. Enter abre os detalhes.</p>
    <div className="evolucao-area">
      <div className="evolucao-escala" aria-hidden="true"><span>{moeda(escala)}</span><span>{moeda(escala/2)}</span><span>R$ 0</span></div>
      <div className="evolucao-interacao" role="slider" tabIndex={0} aria-label={diaSelecionado ? 'Consultar produção por hora' : 'Consultar produção por dia'} aria-orientation="horizontal" aria-valuemin={0} aria-valuemax={itens.length-1} aria-valuenow={indice} aria-valuetext={`${atual.completo}. ${atual.desconhecido ? 'Sem valor confirmado' : `Produção ${moeda(atual.produzido)}, comissão ${moeda(atual.comissao)}, ${atual.atendimentos} atendimentos`}`} aria-describedby={`${id}-ajuda`} aria-controls={`${id}-tooltip`}
        onFocus={() => setVisivel(true)} onKeyDown={e => { if (['ArrowRight','ArrowLeft','Home','End','Enter','Escape'].includes(e.key)) { e.preventDefault(); if(e.key === 'Enter') abrir(); else if(e.key === 'Escape') setVisivel(false); else mudar(e.key === 'Home' ? 0 : e.key === 'End' ? itens.length-1 : indice + (e.key === 'ArrowRight' ? 1 : -1)); } }}
        onPointerMove={e => { if (e.pointerType !== 'mouse') return; const r=e.currentTarget.getBoundingClientRect(); mudar(Math.round(((e.clientX-r.left)/r.width*1000-20)/960*(itens.length-1))); }}
        onPointerDown={e => { const r=e.currentTarget.getBoundingClientRect(); mudar(Math.round(((e.clientX-r.left)/r.width*1000-20)/960*(itens.length-1))); }}>
        <svg viewBox="0 0 1000 220" preserveAspectRatio="none" aria-hidden="true">
          {[20,110,200].map(v=><line key={v} x1="0" x2="1000" y1={v} y2={v} className="evolucao-grade" />)}
          <path d={linha} className="evolucao-linha" />
          {visivel && <line x1={x(indice)} x2={x(indice)} y1="10" y2="200" className="evolucao-guia" />}
          {visivel && !atual.desconhecido && <ellipse cx={x(indice)} cy={y(atual.produzido)} rx="5" ry="5" className="evolucao-ponto" />}
        </svg>
      </div>
    </div>
    <div className="evolucao-datas" aria-hidden="true">{[0,Math.floor((itens.length-1)/2),itens.length-1].filter((n,i,a)=>a.indexOf(n)===i).map(n=><span key={n}>{itens[n].rotulo}</span>)}</div>
    <div className="evolucao-consulta">
      <div className="evolucao-passos"><button aria-label={diaSelecionado ? 'Hora anterior' : 'Dia anterior'} onClick={()=>mudar(indice-1)} disabled={indice===0}><CaretLeft size={18}/></button><button aria-label={diaSelecionado ? 'Próxima hora' : 'Próximo dia'} onClick={()=>mudar(indice+1)} disabled={indice===itens.length-1}><CaretRight size={18}/></button></div>
      {visivel && <div id={`${id}-tooltip`} role="tooltip" className="evolucao-tooltip" aria-live="polite"><b>{atual.completo}</b><div><span>Produção <strong>{atual.desconhecido ? (atual.pendentes ? 'A conferir' : '—') : moeda(atual.produzido)}</strong></span><span>Comissão <strong>{atual.desconhecido ? (atual.pendentes ? 'A conferir' : '—') : moeda(atual.comissao)}</strong></span><span>Atendimentos <strong>{atual.desconhecido ? '—' : atual.atendimentos}</strong></span></div>{atual.manuais>0 && <p>{atual.manuais} lançamento(s) manual(is), incluídos no valor.</p>}{atual.pendentes>0 && <p>{atual.pendentes} registro(s) fora do cálculo. Valores parciais.</p>}{atual.desconhecido && !atual.pendentes && <p>Data futura, sem lançamentos.</p>}</div>}
      <button className="evolucao-abrir" onClick={abrir}>{diaSelecionado ? 'Ver atendimentos desta hora' : 'Ver este dia por hora'}</button>
    </div>
    {diaSelecionado && <p className="evolucao-ajuda">Cada serviço entra integralmente na hora de início. Lançamentos sem horário ou de outra data ficam separados abaixo.</p>}
    {horas.slice(24).map(h=><button className="evolucao-grupo" key={h.chave} onClick={()=>onSelecionarHora(h.chave)}>{h.rotulo}<strong>{moeda(h.produzido)}</strong><span>{h.atendimentos} atendimento(s) · {h.manuais} manual(is)</span></button>)}
    {diaSelecionado && (diasIgnorados.find(d=>d.dia===diaSelecionado)?.quantidade ?? 0)>0 && <button className="evolucao-grupo" onClick={()=>onSelecionarHora('a-conferir')}>Registros fora do cálculo<strong>A conferir</strong><span>Sem horário atribuído</span></button>}
  </section>;
}
