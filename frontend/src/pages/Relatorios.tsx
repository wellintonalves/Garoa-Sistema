import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, DollarSign, Users, Scissors } from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { StatCard } from '../components/StatCard';
import api from '../api/client';

export function Relatorios() {
  const [searchParams] = useSearchParams();
  const [carregando, setCarregando] = useState(false);
  const [barbeiros, setBarbeiros] = useState<any[]>([]);
  
  const dataAtual = new Date();
  const dataPrimeiroDia = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), 1).toISOString().split('T')[0];
  const dataHoje = dataAtual.toISOString().split('T')[0];

  const barbeiroIdUrl = searchParams.get('barbeiroId') || 'todos';
  const [filtros, setFiltros] = useState({ inicio: dataPrimeiroDia, fim: dataHoje, barbeiroId: barbeiroIdUrl });
  const [relatorio, setRelatorio] = useState<any>(null);

  useEffect(() => {
    async function carregar() {
      const res = await api.get('/barbeiros');
      setBarbeiros(res.data.filter((b: any) => b.ativo));
    }
    carregar();
  }, []);

  async function buscarRelatorio() {
    setCarregando(true);
    try {
      const res = await api.get('/financeiro/relatorio', { params: filtros });
      setRelatorio(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    buscarRelatorio();
  }, []);

  const fmt = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
        Relatórios & Comissões
      </h1>

      {/* Filtros */}
      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
        <div>
          <label className="input-label">Data Início</label>
          <input type="date" value={filtros.inicio} onChange={e => setFiltros({...filtros, inicio: e.target.value})} className="ds-input" />
        </div>
        <div>
          <label className="input-label">Data Fim</label>
          <input type="date" value={filtros.fim} onChange={e => setFiltros({...filtros, fim: e.target.value})} className="ds-input" />
        </div>
        <div>
          <label className="input-label">Barbeiro</label>
          <select value={filtros.barbeiroId} onChange={e => setFiltros({...filtros, barbeiroId: e.target.value})} className="ds-select" style={{ minWidth: '200px' }}>
            <option value="todos">Todos os Barbeiros</option>
            {barbeiros.map(b => <option key={b.id} value={b.id}>{b.usuario.nome}</option>)}
          </select>
        </div>
        <button onClick={buscarRelatorio} className="btn-secondary">
          <Filter size={14} strokeWidth={1.5} /> Filtrar
        </button>
      </div>

      {carregando ? (
        <LoadingSpinner />
      ) : relatorio ? (
        <>
          {/* Cards de Totais */}
          <div className="dashboard-grid">
            <StatCard
              titulo="Total Bruto (Entradas)"
              valor={fmt(relatorio.consolidado.totalBruto)}
              icone={DollarSign}
            />
            <StatCard
              titulo="Total Comissões Pagas"
              valor={fmt(relatorio.consolidado.totalComissoes)}
              icone={Users}
            />
            <StatCard
              titulo="Líquido Barbearia"
              valor={fmt(relatorio.consolidado.totalLiquido)}
              icone={DollarSign}
              destaque
            />
            <StatCard
              titulo="Atendimentos"
              valor={String(relatorio.consolidado.totalAtendimentos)}
              icone={Scissors}
            />
          </div>

          {/* Resumo por Barbeiro (quando "Todos" está selecionado) */}
          {filtros.barbeiroId === 'todos' && Object.keys(relatorio.consolidado.porBarbeiro).length > 0 && (
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
                Resumo por Barbeiro
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                {Object.values(relatorio.consolidado.porBarbeiro).map((b: any, i) => (
                  <div key={i} style={{ padding: '16px', background: 'var(--bg-surface2)', border: '1px solid var(--border)' }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>{b.nome}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div className="flex justify-between" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}><span style={{ color: 'var(--text-muted)' }}>Produzido:</span><span style={{ color: 'var(--text-primary)' }}>{fmt(b.bruto)}</span></div>
                      <div className="flex justify-between" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}><span style={{ color: 'var(--text-muted)' }}>Comissão:</span><span style={{ color: 'var(--error-text)' }}>{fmt(b.comissao)}</span></div>
                      <div className="flex justify-between" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}><span style={{ color: 'var(--text-muted)' }}>Líquido:</span><span style={{ color: 'var(--success-text)', fontWeight: 500 }}>{fmt(b.liquido)}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabela de Lançamentos */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
              Detalhamento dos Lançamentos
            </h3>
            <div className="table-wrapper">
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Barbeiro / Serviço</th>
                    <th style={{ textAlign: 'right' }}>Valor Total</th>
                    <th style={{ textAlign: 'right' }}>Comissão</th>
                    <th style={{ textAlign: 'right' }}>Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {relatorio.lancamentos.filter((l: any) => l.tipo === 'ENTRADA').map((l: any) => (
                    <tr key={l.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(l.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td>
                        <p style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{l.servico ? l.servico.nome : l.categoria}</p>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{l.barbeiro ? l.barbeiro.usuario.nome : 'Sem Barbeiro'}</p>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)' }}>{fmt(l.valor)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--error-text)' }}>{l.valorComissao ? fmt(l.valorComissao) : '-'}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--success-text)', fontWeight: 500 }}>{l.valorLiquido ? fmt(l.valorLiquido) : fmt(l.valor)}</td>
                    </tr>
                  ))}
                  {relatorio.lancamentos.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>Nenhum dado encontrado para o período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
