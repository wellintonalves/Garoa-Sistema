// Aba Início da barbearia — visão geral para o cliente
import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Calendar, Clock, Scissors } from 'lucide-react';
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

  const proximoAgendamento = agendamentos.find(a =>
    new Date(a.dataHora) > new Date() && (a.status === 'AGUARDANDO' || a.status === 'CONFIRMADO')
  );

  const ultimosServicos = agendamentos
    .filter(a => a.status === 'CONCLUIDO')
    .slice(0, 5);

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

      {/* Próximo Agendamento */}
      {proximoAgendamento ? (
        <div className="mb-6 p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--amber)' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'var(--amber)', marginBottom: '12px' }}>
            Próximo Agendamento
          </p>
          <div className="flex items-center gap-3 mb-3">
            <Calendar size={16} style={{ color: 'var(--amber)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>
              {fmtData(proximoAgendamento.dataHora)}
            </span>
            <Clock size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>
              {fmtHora(proximoAgendamento.dataHora)}
            </span>
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>
            {proximoAgendamento.servico.nome}
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            com {proximoAgendamento.barbeiro.usuario.nome}
          </p>
        </div>
      ) : (
        <div className="mb-6 p-5 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Nenhum agendamento próximo
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-disabled)' }}>
            Agende seu próximo serviço
          </p>
        </div>
      )}

      {/* Botão Agendar */}
      <button
        onClick={() => navigate(`/cliente/barbearia/${barbeariaId}/agendar`)}
        className="btn-primary w-full justify-center mb-8"
        style={{ padding: '16px', fontSize: '14px' }}
      >
        <Calendar size={18} /> Agendar Agora
      </button>

      {/* Últimos Serviços */}
      {ultimosServicos.length > 0 && (
        <div>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'var(--amber)', marginBottom: '12px' }}>
            Últimos Serviços
          </h2>
          <div className="flex flex-col gap-2">
            {ultimosServicos.map(a => (
              <div key={a.id} className="flex items-center justify-between p-3"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>
                    {a.servico.nome}
                  </p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                    {fmtData(a.dataHora)} — {a.barbeiro.usuario.nome}
                  </p>
                </div>
                <span className="badge badge-confirmed">Concluído</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
