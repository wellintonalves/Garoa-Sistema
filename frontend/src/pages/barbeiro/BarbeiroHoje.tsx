// Aba Hoje do barbeiro — agenda do dia atual e conclusão de atendimentos
import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Check, Clock, Scissors } from 'lucide-react';
import barbeiroApi from '../../api/barbeiroApi';

interface AgendamentoHoje {
  id: string;
  dataHora: string;
  status: string;
  valorCobrado: string;
  servico: { nome: string; duracaoMinutos: number };
  cliente: { usuario: { nome: string } };
}

export function BarbeiroHoje() {
  const { barbeiro } = useOutletContext<{ barbeiro: { nome: string } }>();
  const [agendamentos, setAgendamentos] = useState<AgendamentoHoje[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [concluindoId, setConcluindoId] = useState<string | null>(null);

  useEffect(() => {
    carregarAgenda();
  }, []);

  async function carregarAgenda() {
    try {
      const res = await barbeiroApi.get<AgendamentoHoje[]>('/barbeiro/agenda-hoje');
      setAgendamentos(res.data);
    } catch { /* empty */ }
    finally { setCarregando(false); }
  }

  async function concluir(id: string) {
    const formaPagamento = prompt('Forma de pagamento (DINHEIRO, PIX, CARTAO_DEBITO, CARTAO_CREDITO):', 'PIX');
    if (!formaPagamento) return;

    setConcluindoId(id);
    try {
      await barbeiroApi.post(`/barbeiro/concluir-agendamento/${id}`, { formaPagamento });
      await carregarAgenda();
    } catch (err: any) {
      alert(err.response?.data?.erro || 'Erro ao concluir');
    } finally {
      setConcluindoId(null);
    }
  }

  const fmtHora = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  
  const pendentes = agendamentos.filter(a => a.status === 'AGUARDANDO' || a.status === 'CONFIRMADO');
  const concluidos = agendamentos.filter(a => a.status === 'CONCLUIDO');

  return (
    <div className="px-5 py-6 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--cor-icone)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          Hoje
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
          Olá, {barbeiro?.nome.split(' ')[0]}
        </h1>
      </div>

      {carregando ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</p>
      ) : (
        <>
          {/* Pendentes */}
          <div className="mb-8">
            <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--cor-icone)', marginBottom: '12px' }}>
              Próximos Atendimentos ({pendentes.length})
            </h2>
            
            {pendentes.length === 0 ? (
              <div className="p-6 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <Scissors size={24} style={{ color: 'var(--text-disabled)', margin: '0 auto 8px' }} />
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-muted)' }}>Sua agenda está livre.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {pendentes.map(a => (
                  <div key={a.id} className="p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--amber)' }}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <Clock size={14} style={{ color: 'var(--cor-icone)' }} />
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--cor-icone)' }}>
                          {fmtHora(a.dataHora)}
                        </span>
                      </div>
                      <span className="badge badge-info">{a.servico.duracaoMinutos} min</span>
                    </div>
                    
                    <div className="mb-4">
                      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
                        {a.cliente.usuario.nome}
                      </p>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {a.servico.nome} — R$ {Number(a.valorCobrado).toFixed(2)}
                      </p>
                    </div>

                    <button 
                      onClick={() => concluir(a.id)}
                      disabled={concluindoId === a.id}
                      className="btn-primary w-full justify-center"
                      style={{ padding: '12px', fontSize: '12px' }}
                    >
                      <Check size={14} /> {concluindoId === a.id ? 'Concluindo...' : 'Concluir Atendimento'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Concluídos */}
          {concluidos.length > 0 && (
            <div>
              <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Concluídos ({concluidos.length})
              </h2>
              <div className="flex flex-col gap-2">
                {concluidos.map(a => (
                  <div key={a.id} className="flex justify-between items-center p-3" style={{ background: 'var(--bg-surface2)', border: '1px solid var(--border)', opacity: 0.7 }}>
                    <div className="flex items-center gap-3">
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
                        {fmtHora(a.dataHora)}
                      </span>
                      <div>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-primary)' }}>
                          {a.cliente.usuario.nome}
                        </p>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                          {a.servico.nome}
                        </p>
                      </div>
                    </div>
                    <Check size={16} style={{ color: 'var(--success-text)' }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
