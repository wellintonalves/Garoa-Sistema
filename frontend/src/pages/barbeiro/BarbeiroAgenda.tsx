// Aba Agenda Completa do barbeiro — visualização por data
import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import barbeiroApi from '../../api/barbeiroApi';

interface AgendamentoAgenda {
  id: string;
  dataHora: string;
  status: string;
  servico: { nome: string };
  cliente: { usuario: { nome: string } };
}

interface Bloqueio {
  id: string;
  dataInicio: string;
  dataFim: string;
  motivo?: string;
}

export function BarbeiroAgenda() {
  const [dataSel, setDataSel] = useState(new Date().toISOString().split('T')[0]);
  const [agendamentos, setAgendamentos] = useState<AgendamentoAgenda[]>([]);
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [carregando, setCarregando] = useState(false);
  
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState({ dataInicio: '', dataFim: '', motivo: '' });

  function carregar() {
    setCarregando(true);
    Promise.all([
      barbeiroApi.get<AgendamentoAgenda[]>('/barbeiro/agenda', { params: { data: dataSel } }),
      barbeiroApi.get<Bloqueio[]>('/bloqueios') // O backend filtra para o próprio barbeiro
    ]).then(([resAg, resBl]) => {
      setAgendamentos(resAg.data);
      setBloqueios(resBl.data.filter(b => b.dataInicio.startsWith(dataSel)));
    })
    .catch(() => { /* empty */ })
    .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
  }, [dataSel]);

  async function criarBloqueio() {
    try {
      const { barbeiroId } = JSON.parse(localStorage.getItem('@garoa:barbeiro_dados') || '{}');
      await barbeiroApi.post('/bloqueios', { ...form, barbeiroId });
      setModalAberto(false);
      setForm({ dataInicio: '', dataFim: '', motivo: '' });
      carregar();
    } catch (err: any) {
      alert(err.response?.data?.erro || 'Erro ao bloquear horário');
    }
  }

  async function removerBloqueio(id: string) {
    if (!confirm('Remover este bloqueio?')) return;
    try {
      await barbeiroApi.delete(`/bloqueios/${id}`);
      carregar();
    } catch (err: any) {
      alert(err.response?.data?.erro || 'Erro ao remover');
    }
  }

  const fmtHora = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="px-5 py-6 animate-fade-in">
      <div className="flex justify-between items-center mb-5">
        <h1 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '24px', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
          Agenda
        </h1>
        <button onClick={() => setModalAberto(true)} className="btn-secondary text-[10px] px-3 py-2">
          + Bloquear Horário
        </button>
      </div>

      {/* Seletor de Data */}
      <div className="mb-6">
        <label className="input-label"><CalendarIcon size={12} className="inline mr-1" />Escolha a Data</label>
        <input 
          type="date" 
          value={dataSel} 
          onChange={(e) => setDataSel(e.target.value)}
          className="ds-input" 
        />
      </div>

      {/* Lista de Agendamentos e Bloqueios */}
      {carregando ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>Carregando...</p>
      ) : agendamentos.length === 0 && bloqueios.length === 0 ? (
        <div className="p-6 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', color: 'var(--text-muted)' }}>Nenhum agendamento para esta data.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {bloqueios.map(b => (
            <div key={b.id} className="p-4 flex justify-between items-center" style={{ background: 'repeating-linear-gradient(45deg, var(--bg-surface2), var(--bg-surface2) 10px, transparent 10px, transparent 20px)', border: '1px solid var(--border)', borderLeft: '3px solid var(--text-muted)' }}>
              <div>
                <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Bloqueado: {b.motivo || 'Indisponível'}</p>
                <p style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '11px', color: 'var(--text-muted)' }}>{fmtHora(b.dataInicio)} - {fmtHora(b.dataFim)}</p>
              </div>
              <button onClick={() => removerBloqueio(b.id)} className="text-red-500 text-xs hover:underline">
                Remover
              </button>
            </div>
          ))}

          {agendamentos.map(a => (
            <div key={a.id} className="p-4 flex flex-col gap-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderLeft: a.status === 'CONCLUIDO' ? '3px solid var(--success-text)' : a.status === 'CANCELADO' ? '3px solid var(--error-text)' : '3px solid var(--amber)' }}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '14px', color: 'var(--text-primary)' }}>
                    {fmtHora(a.dataHora)}
                  </span>
                </div>
                <span className={`badge ${a.status === 'CONCLUIDO' ? 'badge-confirmed' : a.status === 'CANCELADO' ? 'badge-cancelled' : 'badge-pending'}`}>
                  {a.status}
                </span>
              </div>
              <div>
                <p style={{ fontFamily: 'var(--fonte-interface)', fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
                  {a.cliente.usuario.nome}
                </p>
                <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--text-muted)' }}>
                  {a.servico.nome}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-surface)] w-full max-w-sm p-6 border border-[var(--border)] rounded">
            <h2 className="text-lg mb-4 text-[var(--text-primary)]">Bloquear Horário</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="input-label">Início</label>
                <input type="datetime-local" value={form.dataInicio} onChange={e => setForm({...form, dataInicio: e.target.value})} className="ds-input" />
              </div>
              <div>
                <label className="input-label">Fim</label>
                <input type="datetime-local" value={form.dataFim} onChange={e => setForm({...form, dataFim: e.target.value})} className="ds-input" />
              </div>
              <div>
                <label className="input-label">Motivo (Opcional)</label>
                <input type="text" value={form.motivo} onChange={e => setForm({...form, motivo: e.target.value})} className="ds-input" />
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => setModalAberto(false)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={criarBloqueio} className="btn-primary flex-1">Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
