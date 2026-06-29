// Página de Agenda — calendário semanal com estética industrial
import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, X } from 'lucide-react';
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
  observacoes?: string;
  cliente: { usuario: { nome: string } };
  barbeiroId: string;
  barbeiro: { usuario: { nome: string }; cor: string };
  servico: { nome: string; duracaoMinutos: number; cor: string };
  servicosIds?: string[];
}

interface Barbeiro { id: string; usuario: { nome: string }; cor: string }
interface Cliente { id: string; usuario: { nome: string } }
interface Servico { id: string; nome: string; preco: string; duracaoMinutos: number; cor: string }

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
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [filtroBarbeiro, setFiltroBarbeiro] = useState('todos');

  // Detalhe / Editar / Excluir
  const [detalhe, setDetalhe] = useState<Agendamento | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState<Agendamento | null>(null);
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [formEditar, setFormEditar] = useState({ status: '', dataHora: '', observacoes: '', valorCobrado: '' });

  // Form novo agendamento
  const [form, setForm] = useState({ clienteId: '', barbeiroId: '', servicoId: '', dataHora: '', observacoes: '' });

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
      const todos = resultados.flatMap((r) => r.data);
      setAgendamentos(todos);
    } catch (err) {
      console.error('Erro ao carregar agenda:', err);
    } finally {
      setCarregando(false);
    }
  }, [semanaInicio]);

  const carregarBarbeiros = useCallback(async () => {
    try {
      const res = await api.get<Barbeiro[]>('/barbeiros');
      setBarbeiros(res.data);
    } catch (err) {
      console.error('Erro ao carregar barbeiros:', err);
    }
  }, []);

  useEffect(() => { carregar(); carregarBarbeiros(); }, [carregar, carregarBarbeiros]);

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

  async function excluirAgendamento() {
    if (!confirmarExclusao) return;
    try {
      await api.delete(`/agendamentos/${confirmarExclusao.id}`);
      setConfirmarExclusao(null);
      setDetalhe(null);
      carregar();
    } catch (err) {
      console.error('Erro ao excluir:', err);
    }
  }

  function mudarSemana(direcao: number) {
    const nova = new Date(semanaInicio);
    nova.setDate(nova.getDate() + direcao * 7);
    setSemanaInicio(nova);
  }

  // Para salvarEdicao ser chamada com o agendamento sendo editado,
  // vamos guardar o id do agendamento sendo editado
  const [editandoId, setEditandoId] = useState<string | null>(null);

  function abrirEditarComId(ag: Agendamento) {
    const local = new Date(ag.dataHora);
    const pad = (n: number) => String(n).padStart(2, '0');
    const localStr = `${local.getFullYear()}-${pad(local.getMonth()+1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`;
    setFormEditar({
      status: ag.status,
      dataHora: localStr,
      observacoes: ag.observacoes || '',
      valorCobrado: ag.valorCobrado,
    });
    setEditandoId(ag.id);
    setDetalhe(null);
    setModalEditarAberto(true);
  }

  async function salvarEdicaoFinal() {
    if (!editandoId) return;
    try {
      await api.put(`/agendamentos/${editandoId}`, {
        status: formEditar.status,
        dataHora: new Date(formEditar.dataHora).toISOString(),
        observacoes: formEditar.observacoes,
        valorCobrado: Number(formEditar.valorCobrado),
      });
      setModalEditarAberto(false);
      setEditandoId(null);
      carregar();
    } catch (err) {
      console.error('Erro ao salvar edição:', err);
    }
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
          <button onClick={abrirModal} className="btn-primary">
            <Plus size={14} strokeWidth={1.5} /> Novo
          </button>
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
                        <div
                          key={ag.id}
                          className="group truncate cursor-pointer"
                          onClick={() => setDetalhe(ag)}
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
                            borderRadius: '0 4px 4px 0',
                          }}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <p className="truncate pr-1" style={{ fontWeight: 600 }}>{ag.cliente.usuario.nome}</p>
                            <div className="flex items-center gap-1">
                              {ag.origem === 'ONLINE' && (
                                <span className="bg-[var(--cor-primaria)] text-black px-1 rounded text-[8px] font-bold">WEB</span>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); abrirEditarComId(ag); }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '1px', lineHeight: 0 }}
                                title="Editar"
                              >
                                <Pencil size={10} strokeWidth={1.5} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirmarExclusao(ag); }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '1px', lineHeight: 0 }}
                                title="Excluir"
                              >
                                <Trash2 size={10} strokeWidth={1.5} />
                              </button>
                            </div>
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

      {/* Painel de detalhe do agendamento */}
      {detalhe && (
        <div
          style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: '360px',
            background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)',
            zIndex: 50, display: 'flex', flexDirection: 'column', padding: '24px',
            gap: '16px', overflowY: 'auto',
          }}
        >
          <div className="flex justify-between items-start">
            <h2 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '18px', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
              Agendamento
            </h2>
            <button onClick={() => setDetalhe(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }}>Cliente</p>
              <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>{detalhe.cliente.usuario.nome}</p>
            </div>
            <div>
              <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }}>Barbeiro</p>
              <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', color: 'var(--text-primary)' }}>{detalhe.barbeiro.usuario.nome}</p>
            </div>
            <div>
              <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }}>Serviço</p>
              <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', color: 'var(--text-primary)' }}>{detalhe.servico.nome} · {detalhe.servico.duracaoMinutos} min</p>
            </div>
            <div>
              <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }}>Data / Hora</p>
              <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', color: 'var(--text-primary)' }}>
                {new Date(detalhe.dataHora).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div>
              <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }}>Valor</p>
              <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', color: 'var(--text-primary)' }}>R$ {Number(detalhe.valorCobrado).toFixed(2)}</p>
            </div>
            <div>
              <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }}>Status</p>
              <span style={{
                fontFamily: 'var(--fonte-interface)', fontSize: '11px', fontWeight: 600,
                padding: '4px 10px', borderRadius: '4px',
                background: statusStyles[detalhe.status]?.bg,
                color: statusStyles[detalhe.status]?.border,
                border: `1px solid ${statusStyles[detalhe.status]?.border}`,
              }}>
                {statusLabels[detalhe.status]}
              </span>
            </div>
            {detalhe.observacoes && (
              <div>
                <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '4px' }}>Observações</p>
                <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--text-secondary)' }}>{detalhe.observacoes}</p>
              </div>
            )}
            {detalhe.origem === 'ONLINE' && (
              <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', fontWeight: 700, color: 'black', background: 'var(--cor-primaria)', padding: '2px 8px', borderRadius: '4px', width: 'fit-content' }}>
                AGENDADO ONLINE
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
            <button
              onClick={() => abrirEditarComId(detalhe)}
              className="btn-primary w-full justify-center"
              style={{ gap: '8px' }}
            >
              <Pencil size={14} strokeWidth={1.5} /> Editar
            </button>
            <button
              onClick={() => { setConfirmarExclusao(detalhe); setDetalhe(null); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                width: '100%', padding: '10px', background: 'transparent',
                border: '1px solid #ef4444', color: '#ef4444',
                fontFamily: 'var(--fonte-interface)', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', borderRadius: '4px',
              }}
            >
              <Trash2 size={14} strokeWidth={1.5} /> Excluir
            </button>
          </div>
        </div>
      )}

      {/* Overlay para fechar painel de detalhe */}
      {detalhe && (
        <div
          onClick={() => setDetalhe(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 49 }}
        />
      )}

      {/* Modal Editar Agendamento */}
      <Modal aberto={modalEditarAberto} onFechar={() => { setModalEditarAberto(false); setEditandoId(null); }} titulo="Editar Agendamento">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="input-label">Status</label>
            <select value={formEditar.status} onChange={(e) => setFormEditar({ ...formEditar, status: e.target.value })} className="ds-select">
              <option value="AGUARDANDO">Aguardando</option>
              <option value="CONFIRMADO">Confirmado</option>
              <option value="CONCLUIDO">Concluído</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>
          <div>
            <label className="input-label">Data e Horário</label>
            <input type="datetime-local" value={formEditar.dataHora} onChange={(e) => setFormEditar({ ...formEditar, dataHora: e.target.value })} className="ds-input" />
          </div>
          <div>
            <label className="input-label">Valor Cobrado (R$)</label>
            <input type="number" step="0.01" value={formEditar.valorCobrado} onChange={(e) => setFormEditar({ ...formEditar, valorCobrado: e.target.value })} className="ds-input" />
          </div>
          <div>
            <label className="input-label">Observações</label>
            <textarea value={formEditar.observacoes} onChange={(e) => setFormEditar({ ...formEditar, observacoes: e.target.value })} rows={2} className="ds-textarea" />
          </div>
          <button onClick={salvarEdicaoFinal} className="btn-primary w-full justify-center">
            Salvar Alterações
          </button>
        </div>
      </Modal>

      {/* Modal Confirmar Exclusão */}
      <Modal aberto={!!confirmarExclusao} onFechar={() => setConfirmarExclusao(null)} titulo="Excluir Agendamento">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', color: 'var(--text-secondary)' }}>
            Tem certeza que deseja excluir o agendamento de{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{confirmarExclusao?.cliente.usuario.nome}</strong>{' '}
            — {confirmarExclusao?.servico.nome}?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmarExclusao(null)}
              style={{
                flex: 1, padding: '10px', background: 'var(--bg-surface2)',
                border: '1px solid var(--border)', color: 'var(--text-primary)',
                fontFamily: 'var(--fonte-interface)', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', borderRadius: '4px',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={excluirAgendamento}
              style={{
                flex: 1, padding: '10px', background: '#ef4444',
                border: '1px solid #ef4444', color: 'white',
                fontFamily: 'var(--fonte-interface)', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', borderRadius: '4px',
              }}
            >
              Excluir
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
