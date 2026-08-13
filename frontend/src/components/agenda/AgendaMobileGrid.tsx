import { useEffect, useRef, useState } from 'react';
import { calcularLanes, EventoBase } from '../../utils/lanes';
import { Modal } from '../Modal';

interface Agendamento {
  id: string;
  dataHora: string;
  status: 'AGUARDANDO' | 'CONFIRMADO' | 'CONCLUIDO' | 'CANCELADO';
  valorCobrado: string;
  origem?: string;
  cliente: { id: string; usuario: { nome: string } };
  barbeiroId: string;
  barbeiro: { usuario: { nome: string }; cor: string };
  servico: { nome: string; duracaoMinutos: number; cor: string };
}

interface Bloqueio {
  id: string;
  barbeiroId: string;
  dataInicio: string;
  dataFim: string;
  motivo?: string;
  barbeiro: { usuario: { nome: string } };
}

interface AgendaMobileGridProps {
  agendamentos: Agendamento[];
  bloqueios: Bloqueio[];
  barbeiroSelecionado: string;
  diaMobile: Date;
  horarios: string[];
  setAgendamentoSelecionado: (ag: Agendamento) => void;
  removerBloqueio: (id: string) => void;
  abrirModal: (dataHora: string, barbeiroId: string) => void;
}

const statusStyles: Record<string, { bg: string; border: string; color: string }> = {
  AGUARDANDO:  { bg: 'rgba(var(--cor-primaria-rgb), 0.10)', border: 'var(--amber)', color: 'rgba(var(--cor-primaria-rgb), 0.15)' },
  CONFIRMADO:  { bg: 'var(--bg-surface2)', border: 'var(--border-hover)', color: 'var(--text-primary)' },
  CONCLUIDO:   { bg: 'var(--sucesso-fundo)', border: 'var(--sucesso)', color: 'var(--sucesso)' },
  CANCELADO:   { bg: 'var(--error)', border: 'var(--error-text)', color: 'var(--error-text)' },
};

function formatarNomeServico(ag: Agendamento) {
  return ag.servico.nome;
}

function getDataBrasilia(date: Date): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = formatter.formatToParts(date);
  const day = parts.find(p => p.type === 'day')?.value || '01';
  const month = parts.find(p => p.type === 'month')?.value || '01';
  const year = parts.find(p => p.type === 'year')?.value || '2026';
  return `${year}-${month}-${day}`;
}

function getHoraMinutoBrasilia(date: Date): { hora: number; minuto: number } {
  const formatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false });
  const parts = formatter.formatToParts(date);
  const hora = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minuto = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  return { hora, minuto };
}

export function AgendaMobileGrid({
  agendamentos,
  bloqueios,
  barbeiroSelecionado,
  diaMobile,
  horarios,
  setAgendamentoSelecionado,
  removerBloqueio,
  abrirModal
}: AgendaMobileGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const agora = new Date();
  const [overflowModal, setOverflowModal] = useState<{aberto: boolean; eventos: EventoBase[]}>({ aberto: false, eventos: [] });
  const diaISO = getDataBrasilia(diaMobile);
  const isHoje = diaMobile.toDateString() === agora.toDateString();

  useEffect(() => {
    if (containerRef.current) {
      if (isHoje) {
        const top = ((agora.getHours() - 8) * 60 + agora.getMinutes()) * (48 / 30);
        containerRef.current.scrollTop = Math.max(0, top - 100);
      } else {
        const firstAppt = agendamentos.find(ag => getDataBrasilia(new Date(ag.dataHora)) === diaISO && ag.barbeiroId === barbeiroSelecionado);
        if (firstAppt) {
          const hm = getHoraMinutoBrasilia(new Date(firstAppt.dataHora));
          const top = ((hm.hora - 8) * 60 + hm.minuto) * (48 / 30);
          containerRef.current.scrollTop = Math.max(0, top - 100);
        } else {
          containerRef.current.scrollTop = 0;
        }
      }
    }
  }, [diaISO, barbeiroSelecionado, isHoje]);

  return (
    <div ref={containerRef} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', overflowY: 'auto', overflowX: 'hidden', width: '100%', position: 'relative', maxHeight: '600px' }}>
      <div style={{ position: 'relative' }}>
        {isHoje && (
          <div style={{ position: 'absolute', left: '60px', right: 0, top: `${((agora.getHours() - 8) * 60 + agora.getMinutes()) * (48 / 30)}px`, borderTop: '2px solid var(--cor-primaria)', zIndex: 40, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', left: '-4px', top: '-5px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--cor-primaria)' }} />
          </div>
        )}

        {horarios.map((horario) => (
          <div key={horario} style={{ display: 'grid', gridTemplateColumns: `60px 1fr`, borderBottom: '1px solid var(--border)' }}>
            <div className="text-right pr-3 pt-3" style={{ padding: '8px', fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-disabled)', letterSpacing: '0.04em', height: '48px', position: 'sticky', left: 0, background: 'var(--bg-surface)', zIndex: 30, borderRight: '1px solid var(--border)' }}>
              {horario}
            </div>
            <div style={{ position: 'relative', height: '48px', cursor: 'pointer' }} onClick={() => abrirModal(`${diaISO}T${horario}:00`, barbeiroSelecionado)} />
          </div>
        ))}

        {/* Camada de Eventos */}
        <div style={{ position: 'absolute', top: 0, left: '60px', right: 0, bottom: 0, pointerEvents: 'none' }}>
          {(() => {
            if (horarios.length === 0) return null;
            const evs: EventoBase[] = [];
            agendamentos.filter(ag => getDataBrasilia(new Date(ag.dataHora)) === diaISO && ag.barbeiroId === barbeiroSelecionado && ag.status !== 'CANCELADO').forEach(ag => {
              const hm = getHoraMinutoBrasilia(new Date(ag.dataHora));
              const iniMin = hm.hora * 60 + hm.minuto;
              const dur = ag.servico.duracaoMinutos || 30;
              evs.push({ id: ag.id, inicioMinutos: iniMin, fimMinutos: iniMin + dur, tipo: 'AGENDAMENTO', original: ag });
            });
            bloqueios.filter(bl => getDataBrasilia(new Date(bl.dataInicio)) === diaISO && bl.barbeiroId === barbeiroSelecionado).forEach(bl => {
              const hmIni = getHoraMinutoBrasilia(new Date(bl.dataInicio));
              const hmFim = getHoraMinutoBrasilia(new Date(bl.dataFim));
              evs.push({ id: bl.id, inicioMinutos: hmIni.hora * 60 + hmIni.minuto, fimMinutos: hmFim.hora * 60 + hmFim.minuto, tipo: 'BLOQUEIO', original: bl });
            });

            const hmMin = getHoraMinutoBrasilia(new Date(diaISO + 'T' + horarios[0] + ':00'));
            const minOfDay = hmMin.hora * 60 + hmMin.minuto;
            const lanes = calcularLanes(evs, 2);

            return lanes.map(ev => {
              const laneWidth = 100 / ev.totalLanes;
              const leftOffset = ev.lane * laneWidth;
              const topPx = (ev.inicioMinutos - minOfDay) * (48 / 30);
              const heightPx = (ev.fimMinutos - ev.inicioMinutos) * (48 / 30);

              if (ev.isOverflow) {
                if (ev.overflowCount === undefined) return null;
                return (
                  <div key={`overflow-${ev.id}`} onClick={(e) => { e.stopPropagation(); setOverflowModal({ aberto: true, eventos: ev.grupoCluster || [] }); }}
                    style={{ position: 'absolute', top: `${topPx + 2}px`, left: `${leftOffset}%`, width: `${laneWidth}%`, height: `${heightPx - 4}px`, background: 'var(--bg-surface2)', border: '1px solid var(--border)', zIndex: 30, pointerEvents: 'auto', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--texto-secundario)', fontWeight: 600, fontSize: '0.8125rem' }}>
                    +{ev.overflowCount}
                  </div>
                );
              }

              if (ev.tipo === 'BLOQUEIO') {
                const bl = ev.original as Bloqueio;
                return (
                  <div key={bl.id} className="truncate cursor-pointer flex flex-col" onClick={() => removerBloqueio(bl.id)} title="Clique para remover bloqueio"
                    style={{ position: 'absolute', top: `${topPx + 2}px`, left: `${leftOffset}%`, width: `calc(${laneWidth}% - 4px)`, height: `${heightPx - 4}px`, padding: '4px 8px', background: 'repeating-linear-gradient(45deg, var(--bg-surface2), var(--bg-surface2) 10px, transparent 10px, transparent 20px)', borderLeft: `3px solid var(--texto-secundario)`, color: 'var(--texto-secundario)', fontFamily: 'var(--fonte-interface)', fontSize: '0.8125rem', borderRadius: '0 4px 4px 0', lineHeight: 1.2, zIndex: 20, pointerEvents: 'auto' }}>
                    <p className="truncate pr-1" style={{ fontWeight: 600, marginBottom: '2px' }}>Bloqueado</p>
                    {bl.motivo && <p className="truncate" style={{ fontSize: '0.8125rem' }}>{bl.motivo}</p>}
                  </div>
                );
              }

              const ag = ev.original as Agendamento;
      const st = statusStyles[ag.status] || statusStyles['AGUARDANDO'];
      const title = `${String(Math.floor(ev.inicioMinutos/60)).padStart(2,'0')}:${String(ev.inicioMinutos%60).padStart(2,'0')} · ${ag?.cliente?.usuario?.nome || 'Cliente'} · ${formatarNomeServico(ag)} · ${ag?.barbeiro?.usuario?.nome || 'Barbeiro'}`;
      
      const isCompact = heightPx < 35;
      const clientName = laneWidth < 40 ? ag?.cliente?.usuario?.nome || 'Cliente'.split(' ')[0] : ag?.cliente?.usuario?.nome || 'Cliente';

      return (
        <div key={ag.id} className="cursor-pointer overflow-hidden" onClick={() => setAgendamentoSelecionado(ag)} title={title}
          style={{ position: 'absolute', top: `${topPx + 2}px`, left: `${leftOffset}%`, width: `calc(${laneWidth}% - 4px)`, height: `${heightPx - 4}px`, padding: isCompact ? '2px 4px' : '6px 8px', background: st.bg, borderLeft: `3px solid ${st.color}`, color: 'var(--text-primary)', opacity: ag.status === 'CONCLUIDO' ? 0.7 : 1, fontFamily: 'var(--fonte-interface)', fontSize: '0.8125rem', borderRadius: '0 4px 4px 0', lineHeight: 1.2, zIndex: 20, pointerEvents: 'auto', display: 'flex', flexDirection: isCompact ? 'row' : 'column', gap: isCompact ? '4px' : '0', alignItems: isCompact ? 'center' : 'flex-start', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
          <div className={`flex justify-between items-center overflow-hidden w-full ${isCompact ? '' : 'mb-1.5'}`}>
            <p className="truncate pr-1 shrink-0" style={{ fontWeight: 600, fontSize: isCompact ? '11px' : '13px' }}>{clientName}</p>
            {(!isCompact && ag.origem === 'ONLINE') && <span className="bg-[var(--cor-primaria)] text-[var(--texto-sobre-primaria)] px-1 rounded text-[8px] font-bold shrink-0">WEB</span>}
          </div>
          <div className="overflow-hidden w-full">
            <p className="truncate" style={{ fontFamily: 'var(--fonte-interface)', fontSize: isCompact ? '11px' : '0.8125rem', color: isCompact ? 'var(--texto-secundario)' : 'inherit' }}>
              {isCompact ? ` - ${formatarNomeServico(ag)}` : formatarNomeServico(ag)}
            </p>
          </div>
        </div>
      );
    });
          })()}
        </div>
      </div>

      <Modal aberto={overflowModal.aberto} onFechar={() => setOverflowModal({ aberto: false, eventos: [] })} titulo="Agendamentos">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {overflowModal.eventos.map(ev => {
            if (ev.tipo === 'BLOQUEIO') {
              const bl = ev.original as Bloqueio;
              return (
                <div key={bl.id} style={{ padding: '12px', background: 'var(--bg-surface2)', borderRadius: '8px', borderLeft: '4px solid var(--texto-secundario)' }}>
                  <p style={{ fontWeight: 600 }}>{bl.barbeiro?.usuario?.nome || 'Bloqueado'}</p>
                  <p style={{ fontSize: '13px', color: 'var(--texto-secundario)' }}>{bl.motivo || 'Indisponível'}</p>
                </div>
              );
            }
            const ag = ev.original as Agendamento;
            const st = statusStyles[ag.status] || statusStyles['AGUARDANDO'];
            const labels: any = { AGUARDANDO: 'Aguardando', CONFIRMADO: 'Confirmado', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' };
            return (
              <div key={ag.id} onClick={() => { setAgendamentoSelecionado(ag); setOverflowModal({ aberto: false, eventos: [] }); }} style={{ padding: '12px', background: st.bg, borderRadius: '8px', borderLeft: `4px solid ${st.color}`, display: 'flex', flexDirection: 'column', gap: '4px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontWeight: 600 }}>{ag?.cliente?.usuario?.nome || 'Cliente'}</p>
                  <span style={{ fontSize: '12px', color: st.color, fontWeight: 600 }}>{labels[ag.status]}</span>
                </div>
                <p style={{ fontSize: '13px' }}>{ag.barbeiro?.usuario?.nome} · {formatarNomeServico(ag)}</p>
                <p style={{ fontSize: '13px', color: 'var(--texto-secundario)' }}>{String(Math.floor(ev.inicioMinutos/60)).padStart(2,'0')}:{String(ev.inicioMinutos%60).padStart(2,'0')} - {String(Math.floor(ev.fimMinutos/60)).padStart(2,'0')}:{String(ev.fimMinutos%60).padStart(2,'0')}</p>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
