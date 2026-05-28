// Página de Agenda — calendário semanal com estética industrial
import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import api from '../api/client';

interface Agendamento {
  id: string;
  dataHora: string;
  status: 'AGUARDANDO' | 'CONFIRMADO' | 'CONCLUIDO' | 'CANCELADO';
  valorCobrado: string;
  cliente: { usuario: { nome: string } };
  barbeiro: { usuario: { nome: string } };
  servico: { nome: string; duracaoMinutos: number };
}

interface Barbeiro { id: string; usuario: { nome: string } }
interface Cliente { id: string; usuario: { nome: string } }
interface Servico { id: string; nome: string; preco: string; duracaoMinutos: number }

const statusStyles: Record<string, { bg: string; border: string; color: string }> = {
  AGUARDANDO:  { bg: 'var(--amber-dim)', border: 'var(--amber)', color: 'var(--amber-light)' },
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

  // Form
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

  useEffect(() => { carregar(); }, [carregar]);

  async function abrirModal() {
    try {
      const [b, c, s] = await Promise.all([
        api.get<Barbeiro[]>('/barbeiros'),
        api.get<Cliente[]>('/clientes'),
        api.get<Servico[]>('/servicos'),
      ]);
      setBarbeiros(b.data);
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
            fontFamily: 'var(--font-display)',
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
                fontFamily: 'var(--font-mono)',
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
                    background: isHoje ? 'var(--amber-dim)' : 'transparent',
                  }}
                >
                  <p
                    style={{
                      fontFamily: 'var(--font-mono)',
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
                      fontFamily: 'var(--font-display)',
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
                  fontFamily: 'var(--font-mono)',
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
                  return d.toDateString() === dia.toDateString() &&
                    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` === horario;
                });

                return (
                  <div key={diaIdx} style={{ borderLeft: '1px solid var(--border)', minHeight: '48px', padding: '2px' }}>
                    {agendamentosDoCelula.map((ag) => {
                      const st = statusStyles[ag.status] || statusStyles.AGUARDANDO;
                      return (
                        <div
                          key={ag.id}
                          className="truncate cursor-pointer"
                          style={{
                            padding: '4px 8px',
                            background: st.bg,
                            borderLeft: `2px solid ${st.border}`,
                            color: st.color,
                            fontFamily: 'var(--font-body)',
                            fontSize: '11px',
                            marginBottom: '2px',
                          }}
                        >
                          <p className="truncate" style={{ fontWeight: 500 }}>{ag.cliente.usuario.nome}</p>
                          <p className="truncate" style={{ opacity: 0.7, fontFamily: 'var(--font-mono)', fontSize: '9px' }}>{ag.servico.nome}</p>
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
                fontFamily: 'var(--font-mono)',
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
    </div>
  );
}
