import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, DollarSign, Users, Scissors, TrendingUp, AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { StatCard } from '../components/StatCard';
import api from '../api/client';

interface Consolidado {
  totalBruto: number;
  totalComissoes: number;
  totalLiquido: number;
  totalAtendimentos: number;
  porBarbeiro: Record<string, { nome: string; bruto: number; comissao: number; liquido: number }>;
}

interface Lancamento {
  id: string;
  tipo: string;
  categoria: string;
  descricao?: string;
  valor: number | string;
  formaPagamento: string;
  data: string;
  valorComissao?: number | string | null;
  valorLiquido?: number | string | null;
  barbeiro?: { usuario: { nome: string } } | null;
  servico?: { nome: string } | null;
}

interface RelatorioData {
  consolidado: Consolidado;
  lancamentos: Lancamento[];
}

const FORMA_PAGAMENTO_LABELS: Record<string, string> = {
  DINHEIRO: 'Dinheiro',
  PIX: 'Pix',
  CARTAO_DEBITO: 'Débito',
  CARTAO_CREDITO: 'Crédito',
};

export function Relatorios() {
  const [searchParams] = useSearchParams();
  const [carregando, setCarregando] = useState(false);
  const [barbeiros, setBarbeiros] = useState<any[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const dataAtual = new Date();
  const dataPrimeiroDia = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), 1).toISOString().split('T')[0];
  const dataHoje = dataAtual.toISOString().split('T')[0];

  const barbeiroIdUrl = searchParams.get('barbeiroId') || 'todos';
  const [filtros, setFiltros] = useState({ inicio: dataPrimeiroDia, fim: dataHoje, barbeiroId: barbeiroIdUrl });
  const [relatorio, setRelatorio] = useState<RelatorioData | null>(null);

  useEffect(() => {
    async function carregar() {
      try {
        const res = await api.get('/barbeiros');
        setBarbeiros(res.data.filter((b: any) => b.ativo));
      } catch (e) {
        console.error('Erro ao carregar barbeiros:', e);
      }
    }
    carregar();
  }, []);

  const buscarRelatorio = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const params: Record<string, string> = {
        inicio: filtros.inicio,
        fim: filtros.fim,
      };
      // Só envia barbeiroId se não for "todos"
      if (filtros.barbeiroId && filtros.barbeiroId !== 'todos') {
        params.barbeiroId = filtros.barbeiroId;
      }

      const res = await api.get('/financeiro/relatorio', { params });
      
      if (res.data && res.data.consolidado && Array.isArray(res.data.lancamentos)) {
        setRelatorio(res.data);
      } else {
        console.error('Resposta inesperada da API:', res.data);
        setErro('A API retornou dados em formato inesperado.');
        setRelatorio(null);
      }
    } catch (e: any) {
      console.error('Erro ao buscar relatório:', e);
      let mensagem: string;
      if (e?.response?.status === 404) {
        mensagem = 'Endpoint de relatório não encontrado no servidor. O backend pode estar desatualizado — aguarde o redeploy ou entre em contato com o administrador.';
      } else if (e?.response?.data?.erro) {
        mensagem = e.response.data.erro;
      } else if (e?.code === 'ERR_NETWORK') {
        mensagem = 'Não foi possível conectar ao servidor. Verifique se o backend está rodando.';
      } else {
        mensagem = e?.message || 'Erro desconhecido ao buscar relatório.';
      }
      setErro(mensagem);
      setRelatorio(null);
    } finally {
      setCarregando(false);
    }
  }, [filtros]);

  useEffect(() => {
    buscarRelatorio();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (v: number | string | null | undefined) => {
    const num = Number(v) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const entradas = relatorio?.lancamentos.filter((l) => l.tipo === 'ENTRADA') || [];

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
        <button onClick={buscarRelatorio} className="btn-primary" disabled={carregando}>
          <Filter size={14} strokeWidth={1.5} /> {carregando ? 'Buscando...' : 'Filtrar'}
        </button>
      </div>

      {/* Estado de carregamento */}
      {carregando && <LoadingSpinner />}

      {/* Estado de erro */}
      {!carregando && erro && (
        <div
          className="card"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderLeft: '2px solid var(--error-text)',
            padding: '1.25rem',
          }}
        >
          <AlertCircle size={20} style={{ color: 'var(--error-text)', flexShrink: 0 }} />
          <div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Erro ao carregar relatório
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {erro}
            </p>
          </div>
        </div>
      )}

      {/* Resultado do relatório */}
      {!carregando && !erro && relatorio && (
        <>
          {/* Cards de Totais */}
          <div className="dashboard-grid">
            <StatCard
              titulo="Receita Total (Bruto)"
              valor={fmt(relatorio.consolidado.totalBruto)}
              icone={DollarSign}
              subtexto="Soma de todas as entradas"
            />
            <StatCard
              titulo="Comissões dos Barbeiros"
              valor={fmt(relatorio.consolidado.totalComissoes)}
              icone={Users}
              subtexto="Total pago em comissões"
            />
            <StatCard
              titulo="Lucro Líquido Barbearia"
              valor={fmt(relatorio.consolidado.totalLiquido)}
              icone={TrendingUp}
              destaque
              subtexto="Receita − comissões"
            />
            <StatCard
              titulo="Atendimentos"
              valor={String(relatorio.consolidado.totalAtendimentos)}
              icone={Scissors}
              subtexto="Serviços com barbeiro"
            />
          </div>

          {/* Resumo por Barbeiro (quando "Todos" está selecionado) */}
          {filtros.barbeiroId === 'todos' && Object.keys(relatorio.consolidado.porBarbeiro).length > 0 && (
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
                Resumo por Barbeiro
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                {Object.values(relatorio.consolidado.porBarbeiro).map((b, i) => (
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
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginLeft: '12px', fontWeight: 400 }}>
                {entradas.length} {entradas.length === 1 ? 'registro' : 'registros'}
              </span>
            </h3>
            <div className="table-wrapper">
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Barbeiro / Serviço</th>
                    <th>Forma Pgto</th>
                    <th style={{ textAlign: 'right' }}>Valor Total</th>
                    <th style={{ textAlign: 'right' }}>Comissão</th>
                    <th style={{ textAlign: 'right' }}>Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {entradas.map((l) => (
                    <tr key={l.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {new Date(l.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td>
                        <p style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{l.servico ? l.servico.nome : l.categoria}</p>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {l.barbeiro ? l.barbeiro.usuario.nome : 'Sem Barbeiro'}
                        </p>
                      </td>
                      <td>
                        <span
                          className="badge badge-info"
                          style={{ fontSize: '9px' }}
                        >
                          {FORMA_PAGAMENTO_LABELS[l.formaPagamento] || l.formaPagamento}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)' }}>{fmt(l.valor)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--error-text)' }}>{l.valorComissao ? fmt(l.valorComissao) : '—'}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--success-text)', fontWeight: 500 }}>{l.valorLiquido ? fmt(l.valorLiquido) : fmt(l.valor)}</td>
                    </tr>
                  ))}
                  {entradas.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                        Nenhum lançamento de entrada encontrado para o período selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
