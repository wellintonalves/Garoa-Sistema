// Página de Clientes — estética industrial
import { useEffect, useState } from 'react';
import { Search, Calendar } from 'lucide-react';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import api from '../api/client';

interface Cliente {
  id: string; telefone: string | null; observacoes: string | null;
  usuario: { id: string; nome: string; email: string };
  agendamentos?: Array<{
    id: string; dataHora: string; status: string; valorCobrado: string;
    servico: { nome: string }; barbeiro: { usuario: { nome: string } };
  }>;
}

const statusStyles: Record<string, string> = {
  CONCLUIDO: 'var(--success-text)',
  CONFIRMADO: 'var(--text-primary)',
  AGUARDANDO: 'var(--amber-light)',
  CANCELADO: 'var(--error-text)',
};

export function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);

  async function carregar(termo?: string) {
    setCarregando(true);
    try {
      const r = await api.get<Cliente[]>('/clientes', { params: termo ? { busca: termo } : {} });
      setClientes(r.data);
    } catch (e) { console.error(e); }
    finally { setCarregando(false); }
  }

  useEffect(() => { carregar(); }, []);

  async function verHistorico(id: string) {
    try {
      const r = await api.get<Cliente>(`/clientes/${id}`);
      setClienteSelecionado(r.data);
    } catch (e) { console.error(e); }
  }

  function handleBusca() { carregar(busca || undefined); }

  function getIniciais(nome: string) {
    return nome.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }

  if (carregando) return <LoadingSpinner />;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '32px',
          color: 'var(--text-primary)',
          letterSpacing: '0.04em',
        }}
      >
        Clientes
      </h1>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative w-full sm:max-w-md">
          <Search size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleBusca()}
            placeholder="Buscar por nome ou telefone..."
            className="ds-input"
            style={{ paddingLeft: '36px' }}
          />
        </div>
        <button onClick={handleBusca} className="btn-secondary">
          Buscar
        </button>
      </div>

      {/* Tabela */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table className="ds-table">
            <thead>
            <tr>
              <th>Nome</th>
              <th>Email</th>
              <th>Telefone</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map(c => (
              <tr key={c.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        width: '32px',
                        height: '32px',
                        background: 'var(--amber-dim)',
                        fontFamily: 'var(--font-display)',
                        fontSize: '14px',
                        color: 'var(--amber-light)',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {getIniciais(c.usuario.nome)}
                    </div>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{c.usuario.nome}</span>
                  </div>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>{c.usuario.email}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>{c.telefone || '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    onClick={() => verHistorico(c.id)}
                    className="transition-colors"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--amber)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    Ver Histórico
                  </button>
                </td>
              </tr>
            ))}
            {clientes.length === 0 && (
              <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>Nenhum cliente encontrado</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Modal de histórico */}
      <Modal aberto={!!clienteSelecionado} onFechar={() => setClienteSelecionado(null)} titulo={`Histórico — ${clienteSelecionado?.usuario.nome || ''}`}>
        {clienteSelecionado?.observacoes && (
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginBottom: '1rem',
            padding: '12px',
            background: 'var(--bg-surface2)',
            border: '1px solid var(--border)'
          }}>
            {clienteSelecionado.observacoes}
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
          {clienteSelecionado?.agendamentos?.map(ag => (
            <div
              key={ag.id}
              className="flex items-center justify-between"
              style={{
                padding: '12px',
                background: 'var(--bg-surface2)',
                border: '1px solid var(--border)',
                borderLeft: `2px solid ${statusStyles[ag.status] || 'var(--border)'}`
              }}
            >
              <div className="flex items-center gap-3">
                <Calendar size={14} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{ag.servico.nome}</p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {new Date(ag.dataHora).toLocaleDateString('pt-BR')} — {ag.barbeiro.usuario.nome}
                  </p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: 'var(--amber)' }}>R$ {Number(ag.valorCobrado).toFixed(2)}</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: statusStyles[ag.status] || 'var(--text-muted)', marginTop: '2px' }}>
                  {ag.status}
                </p>
              </div>
            </div>
          ))}
          {(!clienteSelecionado?.agendamentos || clienteSelecionado.agendamentos.length === 0) && (
            <p style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
              Nenhum agendamento encontrado
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
