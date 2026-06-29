// Página de Agenda — calendário semanal com estética industrial
import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Pencil, Trash2, Check } from 'lucide-react';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import api from '../api/client';

function getHoraMinutoBrasilia(date: Date): { hora: number; minuto: number } {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  return {
    hora: parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10),
    minuto: parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10),
  };
}

function getDataBrasilia(date: Date): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const day = parts.find(p => p.type === 'day')?.value || '01';
  const month = parts.find(p => p.type === 'month')?.value || '01';
  const year = parts.find(p => p.type === 'year')?.value || '2026';
  return `${year}-${month}-${day}`;
}

interface Agendamento {
  id: string;
  dataHora: string;
  status: 'AGUARDANDO' | 'CONFIRMADO' | 'CONCLUIDO' | 'CANCELADO';
  valorCobrado: string;
  origem?: string;
  observacoes?: string;
  clienteId?: string;
  servicoId?: string;
  servicosIds?: string[];
  cliente: { usuario: { nome: string } };
  barbeiroId: string;
  barbeiro: { usuario: { nome: string }; cor: string };
  servico: { nome: string; duracaoMinutos: number; cor: string };
}

interface Barbeiro { id: string; usuario: { nome: string }; cor: string }
interface Cliente { id: string; usuario: { nome: string } }
interface Servico { id: string; nome: string; preco: string; duracaoMinutos: number; cor: string }

const statusStyles: Record<string, { bg: string; border: string }> = {
  AGUARDANDO:  { bg: 'rgba(var(--cor-primaria-rgb), 0.10)', border: 'var(--amber)' },
  CONFIRMADO:  { bg: 'var(--bg-surface2)', border: 'var(--border-hover)' },
  CONCLUIDO:   { bg: '#1A3D2A', border: 'var(--success-text)' },
  CANCELADO:   { bg: 'var(--error)', border: 'var(--error-text)' },
};

const statusLabels: Record<string, string> = {
  AGUARDANDO: 'Aguardando', CONFIRMADO: 'Confirmado', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado',
};

const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const horarios = Array.from({ length: 22 }, (_, i) => `${String(Math.floor(i / 2) + 8).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`);

export function Agenda() {
  const [semanaInicio, setSemanaInicio] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); d.setHours(0, 0, 0, 0); return d;
  });
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [filtroBarbeiro, setFiltroBarbeiro] = useState('todos');

  // Detalhe / edição
  const [agDetalhe, setAgDetalhe] = useState<Agendamento | null>(null);
  const [modoDetalhe, setModoDetalhe] = useState<'ver' | 'editar' | 'cancelar'>('ver');
  const [editServicosIds, setEditServicosIds] = useState<string[]>([]);
  const [editStatus, setEditStatus] = useState<string>('');
  const [editObs, setEditObs] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Form novo agendamento
  const [form, setForm] = useState({ clienteId: '', barbeiroId: '', servicoId: '', servicosIds: [] as string[], dataHora: '', observacoes: '' });

  const diasDaSemana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(semanaInicio); d.setDate(semanaInicio.getDate() + i); return d;
  });

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const promises = diasDaSemana.map((d) =>
        api.get<Agendamento[]>('/agendamentos', { params: { data: d.toISOString().split('T')[0] } })
      );
      const resultados = await Promise.all(promises);
      setAgendamentos(resultados.flatMap((r) => r.data));
    } catch (err) { console.error(err); }
    finally { setCarregando(false); }
  }, [semanaInicio]);

  const carregarAuxiliares = useCallback(async () => {
    try {
      const [b, c, s] = await Promise.all([
        api.get<Barbeiro[]>('/barbeiros'),
        api.get<Cliente[]>('/clientes'),
        api.get<Servico[]>('/servicos'),
      ]);
      setBarbeiros(b.data);
      setClientes(c.data);
      setServicos(s.data);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { carregar(); carregarAuxiliares(); }, [carregar, carregarAuxiliares]);

  // Abrir detalhe ao clicar no bloco
  function abrirDetalhe(ag: Agendamento) {
    setAgDetalhe(ag);
    setModoDetalhe('ver');
    setEditServicosIds(ag.servicosIds?.length ? ag.servicosIds : (ag.servicoId ? [ag.servicoId] : []));
    setEditStatus(ag.status);
    setEditObs(ag.observacoes || '');
  }

  async function salvarEdicao() {
    if (!agDetalhe) return;
    setSalvando(true);
    try {
      const servicoPrincipal = editServicosIds[0] || agDetalhe.servicoId;
      const servicosSelecionados = servicos.filter(s => editServicosIds.includes(s.id));
      const valorTotal = servicosSelecionados.length > 0
        ? servicosSelecionados.reduce((acc, s) => acc + Number(s.preco), 0)
        : Number(agDetalhe.valorCobrado);

      await api.put(`/agendamentos/${agDetalhe.id}`, {
        status: editStatus,
        observacoes: editObs,
        servicoId: servicoPrincipal,
        servicosIds: editServicosIds,
        valorCobrado: valorTotal,
      });
      setAgDetalhe(null);
      carregar();
    } catch (err) { console.error(err); }
    finally { setSalvando(false); }
  }

  async function cancelarAgendamento() {
    if (!agDetalhe) return;
    setSalvando(true);
    try {
      await api.delete(`/agendamentos/${agDetalhe.id}`);
      setAgDetalhe(null);
      carregar();
    } catch (err) { console.error(err); }
    finally { setSalvando(false); }
  }

  async function criarAgendamento() {
    try {
      const todosIds = form.servicosIds.length > 0 ? form.servicosIds : (form.servicoId ? [form.servicoId] : []);
      const servicosSel = servicos.filter(s => todosIds.includes(s.id));
      const valorTotal = servicosSel.reduce((acc, s) => acc + Number(s.preco), 0);
      const servicoPrincipal = form.servicoId || todosIds[0];

      await api.post('/agendamentos', {
        ...form,
        servicoId: servicoPrincipal,
        servicosIds: todosIds,
        valorCobrado: valorTotal || 0,
      });
      setModalAberto(false);
      setForm({ clienteId: '', barbeiroId: '', servicoId: '', servicosIds: [], dataHora: '', observacoes: '' });
      carregar();
    } catch (err) { console.error(err); }
  }

  function toggleServicoCriacao(id: string) {
    const atual = form.servicosIds;
    const novo = atual.includes(id) ? atual.filter(i => i !== id) : [...atual, id];
    setForm(prev => ({ ...prev, servicosIds: novo, servicoId: novo[0] || '' }));
  }

  function toggleServicoEdicao(id: string) {
    setEditServicosIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }

  function mudarSemana(direcao: number) {
    const nova = new Date(semanaInicio);
    nova.setDate(nova.getDate() + direcao * 7);
    setSemanaInicio(nova);
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const valorEditTotal = servicos
    .filter(s => editServicosIds.includes(s.id))
    .reduce((acc, s) => acc + Number(s.preco), 0);

  const duracaoEditTotal = servicos
    .filter(s => editServicosIds.includes(s.id))
    .reduce((acc, s) => acc + s.duracaoMinutos, 0);

  const valorCriacaoTotal = servicos
    .filter(s => form.servicosIds.includes(s.id))
    .reduce((acc, s) => acc + Number(s.preco), 0);

  if (carregando) return <LoadingSpinner />;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '32px', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
          Agenda
        </h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center" style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
            <button onClick={() => mudarSemana(-1)} className="p-2" style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
            <span className="px-3 min-w-[180px] text-center" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              {diasDaSemana[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — {diasDaSemana[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <button onClick={() => mudarSemana(1)} className="p-2" style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
          </div>
          <button onClick={() => setModalAberto(true)} className="btn-primary">
            <Plus size={14} strokeWidth={1.5} /> Novo
          </button>
        </div>
      </div>

      {/* Filtro por barbeiro */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFiltroBarbeiro('todos')}
            style={{ background: filtroBarbeiro === 'todos' ? 'var(--amber)' : 'var(--bg-surface)', color: filtroBarbeiro === 'todos' ? 'black' : 'var(--text-primary)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'var(--fonte-interface)', fontSize: '12px', fontWeight: 600 }}>
            Todos
          </button>
          {barbeiros.map((b) => (
            <button key={b.id} onClick={() => setFiltroBarbeiro(b.id)}
              style={{ background: filtroBarbeiro === b.id ? 'var(--amber)' : 'var(--bg-surface)', color: filtroBarbeiro === b.id ? 'black' : 'var(--text-primary)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'var(--fonte-interface)', fontSize: '12px', fontWeight: 600 }}>
              {b.usuario.nome}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-4">
          <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Barbeiros:</span>
          {barbeiros.map(b => (
            <div key={b.id} className="flex items-center gap-1.5">
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: b.cor || '#F97316' }} />
              <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-primary)' }}>{b.usuario.nome}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Calendário */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', overflow: 'auto' }}>
        <div style={{ minWidth: '700px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ padding: '8px' }} />
            {diasDaSemana.map((dia, i) => {
              const isHoje = dia.toDateString() === new Date().toDateString();
              return (
                <div key={i} className="text-center" style={{ padding: '12px', borderLeft: '1px solid var(--border)', background: isHoje ? 'rgba(var(--cor-primaria-rgb), 0.10)' : 'transparent' }}>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {diasSemana[dia.getDay()]}
                  </p>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '24px', color: isHoje ? 'var(--amber)' : 'var(--text-primary)', lineHeight: 1.2 }}>
                    {dia.getDate()}
                  </p>
                </div>
              );
            })}
          </div>

          {horarios.map((horario) => (
            <div key={horario} style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
              <div className="text-right pr-3 pt-3" style={{ padding: '8px', fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-disabled)', letterSpacing: '0.04em' }}>
                {horario}
              </div>
              {diasDaSemana.map((dia, diaIdx) => {
                const agendamentosDoCelula = agendamentos.filter((ag) => {
                  const d = new Date(ag.dataHora);
                  const dataBR = getDataBrasilia(d);
                  const diaISO = dia.toISOString().split('T')[0];
                  const hm = getHoraMinutoBrasilia(d);
                  const horarioAg = `${String(hm.hora).padStart(2, '0')}:${String(hm.minuto).padStart(2, '0')}`;
                  const checkBarbeiro = filtroBarbeiro === 'todos' || ag.barbeiroId === filtroBarbeiro;
                  return dataBR === diaISO && horarioAg === horario && checkBarbeiro;
                });

                return (
                  <div key={diaIdx} style={{ borderLeft: '1px solid var(--border)', minHeight: '48px', padding: '2px' }}>
                    {agendamentosDoCelula.map((ag) => {
                      const isCancelado = ag.status === 'CANCELADO';
                      const isConcluido = ag.status === 'CONCLUIDO';
                      const corB = isCancelado ? '#ef4444' : (ag.barbeiro.cor || '#F97316');
                      const bgB = isCancelado ? '#ef444420' : (corB + '20');
                      const corS = ag.servico.cor || '#22C55E';
                      const bgS = corS + '30';

                      return (
                        <div key={ag.id} onClick={() => abrirDetalhe(ag)}
                          className="truncate cursor-pointer group relative"
                          style={{ padding: '4px 8px', background: bgB, borderLeft: `3px solid ${corB}`, color: 'var(--text-primary)', opacity: isConcluido ? 0.7 : 1, fontFamily: 'var(--fonte-interface)', fontSize: '11px', marginBottom: '4px', borderRadius: '0 4px 4px 0' }}>
                          <div className="flex justify-between items-start mb-1">
                            <p className="truncate pr-1" style={{ fontWeight: 600 }}>{ag.cliente.usuario.nome}</p>
                            {ag.origem === 'ONLINE' && (
                              <span className="bg-[var(--cor-primaria)] text-black px-1 rounded text-[8px] font-bold">WEB</span>
                            )}
                          </div>
                          <p className="truncate" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '9px', background: bgS, color: 'var(--text-primary)', padding: '2px 4px', borderRadius: '2px', display: 'inline-block', border: `1px solid ${corS}50` }}>
                            {ag.servico.nome}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-4">
        {Object.entries(statusStyles).map(([status, st]) => (
          <div key={status} className="flex items-center gap-2">
            <div style={{ width: '12px', height: '12px', background: st.bg, borderLeft: `2px solid ${st.border}` }} />
            <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              {statusLabels[status]}
            </span>
          </div>
        ))}
      </div>

      {/* Modal Detalhe / Editar Agendamento */}
      {agDetalhe && (
        <div
          onClick={() => setAgDetalhe(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', width: '100%', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto' }}
          >
            {/* Cabeçalho do detalhe */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {modoDetalhe === 'ver' && 'Detalhes do Agendamento'}
                {modoDetalhe === 'editar' && 'Editar Agendamento'}
                {modoDetalhe === 'cancelar' && 'Cancelar Agendamento'}
              </span>
              <div className="flex gap-2 items-center">
                {modoDetalhe === 'ver' && agDetalhe.status !== 'CANCELADO' && (
                  <>
                    <button onClick={() => setModoDetalhe('editar')} title="Editar"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--fonte-interface)', fontSize: '11px' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--amber)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--amber)'; }}
               