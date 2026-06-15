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

export function BarbeiroAgenda() {
  const [dataSel, setDataSel] = useState(new Date().toISOString().split('T')[0]);
  const [agendamentos, setAgendamentos] = useState<AgendamentoAgenda[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    setCarregando(true);
    barbeiroApi.get<AgendamentoAgenda[]>('/barbeiro/agenda', { params: { data: dataSel } })
      .then(res => setAgendamentos(res.data))
      .catch(() => { /* empty */ })
      .finally(() => setCarregando(false));
  }, [dataSel]);

  const fmtHora = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="px-5 py-6 animate-fade-in">
      <h1 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '24px', color: 'var(--text-primary)', marginBottom: '20px', letterSpacing: '0.04em' }}>
        Agenda
      </h1>

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

      {/* Lista de Agendamentos */}
      {carregando ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>Carregando...</p>
      ) : agendamentos.length === 0 ? (
        <div className="p-6 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', color: 'var(--text-muted)' }}>Nenhum agendamento para esta data.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
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
                <p style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '11px', color: 'var(--text-muted)' }}>
                  {a.servico.nome}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
