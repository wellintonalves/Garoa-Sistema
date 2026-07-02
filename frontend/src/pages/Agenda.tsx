// Página de Agenda — calendário semanal com estética industrial
import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import api from '../api/client';

/** Extrai hora e minuto de um Date no fuso de Brasília */
function getHoraMinutoBrasilia(date: Date): { hora: number; minuto: number } {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hora = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minuto = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  return { hora, minuto };
}

/** Extrai data no fuso de Brasília como string YYYY-MM-DD */
function getDataBrasilia(date: Date): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
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
  cliente: { usuario: { nome: string } };
  barbeiroId: string;
  barbeiro: { usuario: { nome: string }; cor: string };
  servico: { nome: string; duracaoMinutos: number; cor: string };
}

interface Barbeiro { id: string; usuario: { nome: string }; cor: string }
interface Cliente { id: string; usuario: { nome: string } }
interface Servico { id: string; nome: string; preco: string; duracaoMinutos: number; cor: string }
interface Bloqueio {
  id: string;
  barbeiroId: string;
  dataInicio: string;
  dataFim: string;
  motivo?: string;
  barbeiro: { usuario: { nome: string } };
}

const statusStyles: Record<string, { bg: string; border: string; color: string }> = {
  AGUARDANDO:  { bg: 'rgba(var(--cor-primaria-rgb), 0.10)', border: 'var(--amber)', color: 'rgba(var(--cor-primaria-rgb), 0.15)' },
  CONFIRMADO:  { bg: 'var(--bg-surface2)', border: 'var(--border-hover)', color: 'var(--text-primary)' },
  CONCLUIDO:   { bg: '#1A3D2A', border: 'var(--success-text)', color: 'var(--success-text)' },
  CANCELADO:   { bg: 'var(--error)', border: 'var(--error-text)', color: 'var(--error-text)' },
};

const statusLabels: Record<string, string> = {
  AGUARDANDO: 'Aguardando',
  CONFIRMADO: 'Confirmado',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
};

const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const horarios = Array.from({ length: 22 }, (_, i) => `${String(Math.floor(i / 2) + 8).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`);

export function Agenda() {
  const [semanaInicio, setSemanaInicio] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); d.setHours(0, 0, 0, 0); return d;
  });
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalBloqueioAberto, setModalBloqueioAberto] = useState(false);
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [filtroBarbeiro, setFiltroBarbeiro] = useState('todos');

  // Form
  const [form, setForm] = useState({ clienteId: '', barbeiroId: '', servicoId: '', dataHora: '', observacoes: '' });
  const [formBloqueio, setFormBloqueio] = useState({ barbeiroId: '', data: '', horaInicio: '', horaFim: '', motivo: '' });

  const diasDaSemana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(semanaInicio); d.setDate(semanaInicio.getDate() + i); return d;
  });

  const carregar = useCallback(async () => {
    setCarregando(true);
    
    try {
      const dataInicio = diasDaSemana[0].toISOString().split('T')[0];
      const dataFim = diasDaSemana[6].toISOString().split('T')[0];

      const [resAgendamentos, resBloq, resBarb] = await Promise.allSettled([
        api.get<Agendamento[]>('/agendamentos', { params: { dataInicio, dataFim } }),
        api.get<Bloqueio[]>('/bloqueios'),
        api.get<Barbeiro[]>('/barbeiros')
      ]);

      if (resAgendamentos.status === 'fulfilled') {
        setAgendamentos(resAgendamentos.value.data);
      } else {
        console.error('Erro ao carregar agendamentos:', resAgendamentos.reason);
      }

      if (resBloq.status === 'fulfilled') {
        setBloqueios(resBloq.value.data);
      } else {
        console.error('Erro ao carregar bloqueios:', resBloq.reason);
      }

      if (resBarb.status === 'fulfilled') {
        setBarbeiros(resBarb.value.data);
      } else {
        console.error('Erro ao carregar barbeiros:', resBarb.reason);
      }
    } catch (err) {
      console.error('Erro inesperado no carregar:', err);
    }

    setCarregando(false);
  }, [semanaInicio]);

  useEffect(() => { carregar(); }, [carregar]);

  async function abrirModal() {
    try {
      const [c, s] = await Promise.all([
        api.get<Cliente[]>('/clientes'),
        api.get<Servico[]>('/servicos'),
      ]);
      setClientes(c.data);
      setServicos(s.data);
      setModalAberto(true);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  }

  async function criarAgendamento() {
    try {
      const servico = servicos.find((s) => s.id === form.servicoId);
      await api.post('/agendamentos', { ...form, valorCobrado: servico ? Number(servico.preco) : 0 });
      setModalAberto(false);
      setForm({ clienteId: '', barbeiroId: '', servicoId: '', dataHora: '', observacoes: '' });
      carregar();
    } catch (err) {
      console.error('Erro ao criar agendamento:', err);
    }
  }

  async function criarBloqueio() {
    try {
      const dataInicioStr = `${formBloqueio.data}T${formBloqueio.horaInicio}:00-03:00`;
      const dataFimStr = `${formBloqueio.data}T${formBloqueio.horaFim}:00-03:00`;
      await api.post('/bloqueios', {
        barbeiroId: formBloqueio.barbeiroId,
        dataInicio: dataInicioStr,
        dataFim: dataFimStr,
        motivo: formBloqueio.motivo
      });
      setModalBloqueioAberto(false);
      setFormBloqueio({ barbeiroId: '', data: '', horaInicio: '', horaFim: '', motivo: '' });
      carregar();
    } catch (err: any) {
      alert(err.response?.data?.erro || 'Erro ao criar bloqueio');
    }
  }

  async function removerBloqueio(id: string) {
    if (!confirm('Deseja realmente remover este bloqueio?')) return;
    try {
      await api.delete(`/bloqueios/${id}`);
      carregar();
    } catch (err: any) {
      alert(err.response?.data?.erro || 'Erro ao remover bloqueio');
    }
  }

  function mudarSemana(direcao: number) {
    const nova = new Date(semanaInicio);
    nova.setDate(nova.getDate() + direcao * 7);
    setSemanaInicio(nova);
  }

  if (carregando) return <LoadingSpinner />;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1
          style={{
            fontFamily: 'var(--fonte-interface)',
            fontSize: '32px',
            color: 'var(--text-primary)',
            letterSpacing: '0.04em',
          }}
        >
          Agenda
        </h1>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
            }}
          >
            <button
              onClick={() => mudarSemana(-1)}
              className="p-2 transition-colors"
              style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
            <span
              className="px-3 min-w-[180px] text-center"
              style={{
                fontFamily: 'var(--fonte-interface)',
                fontSize: '11px',
                color: 'var(--text-muted)',
                letterSpacing: '0.04em',
              }}
            >
              {diasDaSemana[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — {diasDaSemana[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <button
              onClick={() => mudarSemana(1)}
              className="p-2 transition-colors"
              style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setModalBloqueioAberto(true)} className="btn-secondary">
              Bloquear Horário
            </button>
            <button onClick={abrirModal} className="btn-primary">
              <Plus size={14} strokeWidth={1.5} /> Novo Agendamento
            </button>
          </div>
        </div>
      </div>

      {/* Filtros e Legenda */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFiltroBarbeiro('todos')}
            style={{ background: filtroBarbeiro === 'todos' ? 'var(--amber)' : 'var(--bg-surface)', color: filtroBarbeiro === 'todos' ? 'black' : 'var(--text-primary)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'var(--fonte-interface)', fontSize: '12px', fontWeight: 600 }}
          >
            Todos
          </button>
          {barbeiros.map((b) => (
            <button
              key={b.id}
              onClick={() => setFiltroBarbeiro(b.id)}
              style={{ background: filtroBarbeiro === b.id ? 'var(--amber)' : 'var(--bg-surface)', color: filtroBarbeiro === b.id ? 'black' : 'var(--text-primary)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'var(--fonte-interface)', fontSize: '12px', fontWeight: 600 }}
            >
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

      {/* Calendário semanal */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', overflow: 'auto' }}>
        <div style={{ minWidth: '700px' }}>
          {/* Cabeçalho dos dias */}
          <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ padding: '8px' }} />
            {diasDaSemana.map((dia, i) => {
              const isHoje = dia.toDateString() === new Date().toDateString();
              return (
                <div
                  key={i}
                  className="text-center"
                  style={{
                    padding: '12px',
                    borderLeft: '1px solid var(--border)',
                    background: isHoje ? 'rgba(var(--cor-primaria-rgb), 0.10)' : 'transparent',
                  }}
                >
                  <p
                    style={{
                      fontFamily: 'var(--fonte-interface)',
                      fontSize: '9px',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {diasSemana[dia.getDay()]}
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--fonte-interface)',
                      fontSize: '24px',
                      color: isHoje ? 'var(--amber)' : 'var(--text-primary)',
                      lineHeight: 1.2,
                    }}
                  >
                    {dia.getDate()}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Grid de horários */}
          {horarios.map((horario) => (
            <div key={horario} style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
              <div
                className="text-right pr-3 pt-3"
                style={{
                  padding: '8px',
                  fontFamily: 'var(--fonte-interface)',
                  fontSize: '10px',
                  color: 'var(--text-disabled)',
                  letterSpacing: '0.04em',
                }}
              >
                {horario}
              </div>
              {diasDaSemana.map((dia, diaIdx) => {
                const diaISO = dia.toISOString().split('T')[0];

                const agendamentosDoCelula = agendamentos.filter((ag) => {
                  const d = new Date(ag.dataHora);
                  const dataBR = getDataBrasilia(d);
                  const hm = getHoraMinutoBrasilia(d);
                  const horarioAg = `${String(hm.hora).padStart(2, '0')}:${String(hm.minuto).padStart(2, '0')}`;
                  
                  const checkBarbeiro = filtroBarbeiro === 'todos' || ag.barbeiroId === filtroBarbeiro;
                  return dataBR === diaISO && horarioAg === horario && checkBarbeiro;
                });

                const bloqueiosDaCelula = bloqueios.filter((bl) => {
                  const dInicio = new Date(bl.dataInicio);
                  const dFim = new Date(bl.dataFim);
                  const dtAtual = new Date(diaISO + 'T' + horario + ':00-03:00'); // Hora do slot atual em SP

                  // Consideramos o bloqueio na célula se o slot começar dentro do bloqueio
                  const dentroBloqueio = dtAtual >= dInicio && dtAtual < dFim;
                  
                  const checkBarbeiro = filtroBarbeiro === 'todos' || bl.barbeiroId === filtroBarbeiro;
                  return dentroBloqueio && checkBarbeiro;
                });

                return (
                  <div key={diaIdx} style={{ borderLeft: '1px solid var(--border)', minHeight: '48px', padding: '2px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {bloqueiosDaCelula.map((bl) => (
                      <div
                        key={bl.id}
                        className="truncate cursor-pointer"
                        onClick={() => removerBloqueio(bl.id)}
                        title="Clique para remover bloqueio"
                        style={{
                          padding: '4px 8px',
                          background: 'repeating-linear-gradient(45deg, var(--bg-surface2), var(--bg-surface2) 10px, transparent 10px, transparent 20px)',
                          borderLeft: `3px solid var(--text-muted)`,
                          color: 'var(--text-muted)',
                          fontFamily: 'var(--fonte-interface)',
                          fontSize: '11px',
                          borderRadius: '0 4px 4px 0'
                        }}
                      >
                        <p className="truncate pr-1" style={{ fontWeight: 600 }}>{bl.barbeiro.usuario.nome}</p>
                        <p className="truncate" style={{ fontSize: '9px' }}>Bloqueado: {bl.motivo || 'Indisponível'}</p>
                      </div>
                    ))}

                    {agendamentosDoCelula.map((ag) => {
                      const isCancelado = ag.status === 'CANCELADO';
                      const isConcluido = ag.status === 'CONCLUIDO';
                      const corB = isCancelado ? '#ef4444' : (ag.barbeiro.cor || '#F97316');
                      const bgB = isCancelado ? '#ef444420' : (corB + '20');
                      
                      const corS = ag.servico.cor || '#22C55E';
                      const bgS = corS + '30';

                      return (
                        <div
                          key={ag.id}
                          className="truncate cursor-pointer"
                          style={{
                            padding: '4px 8px',
                            background: bgB,
                            borderLeft: `3px solid ${corB}`,
                            color: 'var(--text-primary)',
                            opacity: isConcluido ? 0.7 : 1,
                            fontFamily: 'var(--fonte-interface)',
                            fontSize: '11px',
                            marginBottom: '4px',
                            position: 'relative',
                            borderRadius: '0 4px 4px 0'
                          }}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <p className="truncate pr-1" style={{ fontWeight: 600 }}>{ag.cliente.usuario.nome}</p>
                            {ag.origem === 'ONLINE' && (
                              <span className="bg-[var(--cor-primaria)] text-black px-1 rounded text-[8px] font-bold">WEB</span>
                            )}
                          </div>
                          <p className="truncate" style={{ 
                            fontFamily: 'var(--fonte-interface)', 
                            fontSize: '9px', 
                            background: bgS, 
                            color: 'var(--text-primary)',
                            padding: '2px 4px', 
                            borderRadius: '2px', 
                            display: 'inline-block', 
                            border: `1px solid ${corS}50` 
                          }}>
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
            <span
              style={{
                fontFamily: 'var(--fonte-interface)',
                fontSize: '9px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}
            >
              {statusLabels[status]}
            </span>
          </div>
        ))}
      </div>

      {/* Modal para novo agendamento */}
      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Novo Agendamento">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="input-label">Cliente</label>
            <select value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })} className="ds-select">
              <option value="">Selecione...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.usuario.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Barbeiro</label>
            <select value={form.barbeiroId} onChange={(e) => setForm({ ...form, barbeiroId: e.target.value })} className="ds-select">
              <option value="">Selecione...</option>
              {barbeiros.map((b) => <option key={b.id} value={b.id}>{b.usuario.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Serviço</label>
            <select value={form.servicoId} onChange={(e) => setForm({ ...form, servicoId: e.target.value })} className="ds-select">
              <option value="">Selecione...</option>
              {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome} — R$ {Number(s.preco).toFixed(2)}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Data e Horário</label>
            <input type="datetime-local" value={form.dataHora} onChange={(e) => setForm({ ...form, dataHora: e.target.value })} className="ds-input" />
          </div>
          <div>
            <label className="input-label">Observações</label>
            <textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} className="ds-textarea" />
          </div>
          <button onClick={criarAgendamento} className="btn-primary w-full justify-center">
            Criar Agendamento
          </button>
        </div>
      </Modal>

      {/* Modal para Bloqueio de Agenda */}
      <Modal aberto={modalBloqueioAberto} onFechar={() => setModalBloqueioAberto(false)} titulo="Bloquear Horário">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="input-label">Barbeiro</label>
            <select value={formBloqueio.barbeiroId} onChange={(e) => setFormBloqueio({ ...formBloqueio, barbeiroId: e.target.value })} className="ds-select">
              <option value="">Selecione...</option>
              {barbeiros.map((b) => <option key={b.id} value={b.id}>{b.usuario.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Data</label>
            <input type="date" value={formBloqueio.data} onChange={(e) => setFormBloqueio({ ...formBloqueio, data: e.target.value })} className="ds-input" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="input-label">Hora Início</label>
              <input type="time" value={formBloqueio.horaInicio} onChange={(e) => setFormBloqueio({ ...formBloqueio, horaInicio: e.target.value })} className="ds-input" />
            </div>
            <div className="flex-1">
              <label className="input-label">Hora Fim</label>
              <input type="time" value={formBloqueio.horaFim} onChange={(e) => setFormBloqueio({ ...formBloqueio, horaFim: e.target.value })} className="ds-input" />
            </div>
          </div>
          <div>
            <label className="input-label">Motivo (Opcional)</label>
            <input type="text" value={formBloqueio.motivo} onChange={(e) => setFormBloqueio({ ...formBloqueio, motivo: e.target.value })} placeholder="Ex: Almoço, Atestado" className="ds-input" />
          </div>
          <button onClick={criarBloqueio} className="btn-secondary w-full justify-center text-white bg-red-600 hover:bg-red-700">
            Confirmar Bloqueio
          </button>
        </div>
      </Modal>
    </div>
  );
}
