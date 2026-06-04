// Aba Início da barbearia — visão geral para o cliente
import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Calendar, Clock, Scissors, Plus } from 'lucide-react';
import clienteApi from '../../../api/clienteApi';

interface BarbeariaCtx {
  barbearia: { id: string; nome: string; logo: string | null } | null;
  barbeariaId: string;
}

interface AgendamentoItem {
  id: string;
  dataHora: string;
  status: string;
  valorCobrado: string;
  servico: { nome: string };
  barbeiro: { usuario: { nome: string } };
}

export function ClienteBarbeariaInicio() {
  const navigate = useNavigate();
  const { barbeariaId } = useParams<{ barbeariaId: string }>();
  const { barbearia } = useOutletContext<BarbeariaCtx>();
  const [agendamentos, setAgendamentos] = useState<AgendamentoItem[]>([]);

  useEffect(() => {
    if (barbeariaId) {
      clienteApi.get<AgendamentoItem[]>(`/cliente/barbearia/${barbeariaId}/agendamentos`)
        .then(res => setAgendamentos(res.data))
        .catch(() => { /* empty */ });
    }
  }, [barbeariaId]);

  const agendamentosFuturos = agendamentos
    .filter(a => new Date(a.dataHora) >= new Date() && a.status !== 'CANCELADO' && a.status !== 'CONCLUIDO')
    .sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime());

  const agendamentosPassados = agendamentos
    .filter(a => new Date(a.dataHora) < new Date() || a.status === 'CONCLUIDO')
    .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());

  const fmtData = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmtHora = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="px-5 py-6 animate-fade-in">
      {/* Header da barbearia */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--amber-dim)' }}>
          <Scissors size={28} style={{ color: 'var(--amber-light)' }} />
        </div>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            {barbearia?.nome || 'Barbearia'}
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
            Seu espaço
          </p>
        </div>
      </div>

      {/* Agendamentos Futuros */}
      {agendamentosFuturos.length > 0 ? (
        <div className="mb-6">
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'var(--amber)', marginBottom: '12px' }}>
            Agendamentos Futuros
          </h2>
          <div className="flex flex-col gap-3">
            {agendamentosFuturos.map((ag) => (
              <div key={ag.id} className="p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--amber)', borderRadius: '4px' }}>
                <div className="flex items-center gap-3 mb-3">
                  <Calendar size={16} style={{ color: 'var(--amber)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>
                    {fmtData(ag.dataHora)}
                  </span>
                  <Clock size={14} style={{ color: 'var(--text-muted)', marginLeft: '8px' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>
                    {fmtHora(ag.dataHora)}
                  </span>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {ag.servico.nome}
                    </p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      com {ag.barbeiro.usuario.nome}
                    </p>
                  </div>
                  <span className="badge badge-info" style={{ fontSize: '10px' }}>
                    {ag.status === 'AGUARDANDO' ? 'Aguardando' : 'Confirmado'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-6 p-6 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Calendar size={32} style={{ color: 'var(--text-disabled)', marginBottom: '16px' }} />
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-primary)', marginBottom: '8px', fontWeight: 600 }}>
            Nenhum agendamento futuro
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Que tal agendar um horário agora?
          </p>
          <button
            onClick={() => navigate(`/cliente/barbearia/${barbeariaId}/agendar`)}
            className="btn-primary"
            style={{ padding: '12px 24px' }}
          >
            Agendar Agora
          </button>
        </div>
      )}

      {/* Botão Agendar (só mostra se já tem agendamento futuro, pois o empty state já tem o botão) */}
      {agendamentosFuturos.length > 0 && (
        <button
          onClick={() => navigate(`/cliente/barbearia/${barbeariaId}/agendar`)}
          className="btn-primary w-full justify-center mb-8"
          style={{ padding: '16px', fontSize: '14px' }}
        >
          <Plus size={18} /> Novo Agendamento
        </button>
      )}

      {/* Últimos Serviços */}
      {agendamentosPassados.length > 0 && (
        <div>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'var(--text-muted)', marginBottom: '12px' }}>
            Histórico
          </h2>
          <div className="flex flex-col gap-2">
            {agendamentosPassados.map(a => (
              <div key={a.id} className="flex items-center justify-between p-3"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '4px', opacity: 0.8 }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>
                    {a.servico.nome}
                  </p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                    {fmtData(a.dataHora)} — {a.barbeiro.usuario.nome}
                  </p>
                </div>
                {a.status === 'CONCLUIDO' ? (
                  <span className="badge" style={{ background: '#1A3D2A', color: 'var(--success-text)' }}>Concluído</span>
                ) : a.status === 'CANCELADO' ? (
                  <span className="badge" style={{ background: 'var(--error)20', color: 'var(--error-text)', border: '1px solid var(--error)' }}>Cancelado</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
