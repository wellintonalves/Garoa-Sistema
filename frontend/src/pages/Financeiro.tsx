// Página Financeiro — industrial
import { useEffect, useState } from 'react';
import { Plus, TrendingUp, TrendingDown, Edit2, Trash2, Loader2 } from 'lucide-react';
import { Modal } from '../components/Modal';
import { SkeletonPage } from '../components/Skeleton';
import api from '../api/client';
import { hojeBrasilia } from '../utils/datas';

interface Barbeiro { id: string; usuario: { nome: string }; comissaoPercent: number; }
interface Servico { id: string; nome: string; preco: string; }
interface Lancamento {
  id: string; tipo: string; categoria: string; descricao: string | null;
  valor: string; formaPagamento: string; data: string;
  barbeiroId?: string | null;
  servicoId?: string | null;
  barbeiro?: { usuario: { nome: string } };
  servico?: { nome: string };
  valorComissao?: string;
  valorLiquido?: string;
}
interface ResumoDia {
  totalEntradas: number; entradasServicos: number; entradasProdutos: number;
  totalSaidas: number; saldo: number;
  porFormaPagamento: Record<string, number>;
}
interface DadoGrafico { data: string; entradas: number; saidas: number }

const formasPagamento = ['DINHEIRO', 'PIX', 'CARTAO_DEBITO', 'CARTAO_CREDITO'];
const labelsForma: Record<string, string> = {
  DINHEIRO: 'Dinheiro', PIX: 'Pix',
  CARTAO_DEBITO: 'Cartão Débito', CARTAO_CREDITO: 'Cartão Crédito',
};

export function Financeiro() {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [resumo, setResumo] = useState<ResumoDia | null>(null);
  const [grafico, setGrafico] = useState<DadoGrafico[]>([]);
  
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  
  const formPadrao = { tipo: 'ENTRADA', categoria: '', descricao: '', valor: '', formaPagamento: 'PIX', data: hojeBrasilia(), servicoId: '', barbeiroId: '' };
  const [form, setForm] = useState(formPadrao);
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS');

  async function carregar() {
    try {
      const hoje = hojeBrasilia();
      const [l, r, g, b, s] = await Promise.all([
        api.get<Lancamento[]>('/financeiro', { params: { inicio: hoje, fim: hoje } }),
        api.get<ResumoDia>('/financeiro/resumo-dia', { params: { data: hoje } }),
        api.get<DadoGrafico[]>('/financeiro/ultimos-7-dias'),
        api.get<Barbeiro[]>('/barbeiros'),
        api.get<Servico[]>('/servicos')
      ]);
      setLancamentos(l.data); setResumo(r.data); setGrafico(g.data);
      setBarbeiros(b.data.filter((bar: any) => bar.ativo)); 
      setServicos(s.data.filter((srv: any) => srv.ativo));
    } catch (e) { console.error(e); }
    finally { setCarregando(false); }
  }

  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    if (form.servicoId) {
      const servico = servicos.find(s => s.id === form.servicoId);
      if (servico) {
        setForm(prev => ({ ...prev, valor: servico.preco, categoria: 'Serviço Prestado', tipo: 'ENTRADA' }));
      }
    }
  }, [form.servicoId, servicos]);

  function abrirModal(lancamento?: Lancamento) {
    if (lancamento) {
      setEditId(lancamento.id);
      setForm({
        tipo: lancamento.tipo,
        categoria: lancamento.categoria,
        descricao: lancamento.descricao || '',
        valor: lancamento.valor,
        formaPagamento: lancamento.formaPagamento,
        data: lancamento.data.split('T')[0],
        servicoId: lancamento.servicoId || '',
        barbeiroId: lancamento.barbeiroId || ''
      });
    } else {
      setEditId(null);
      setForm(formPadrao);
    }
    setErroSalvar(null);
    setModalAberto(true);
  }

  async function salvarLancamento() {
    if (salvando) return;
    setSalvando(true);
    try {
      const payload = { 
        ...form, 
        valor: Number(form.valor),
        servicoId: form.servicoId || undefined,
        barbeiroId: form.barbeiroId || undefined
      };
      if (editId) {
        await api.put(`/financeiro/${editId}`, payload);
      } else {
        await api.post('/financeiro', payload);
      }
      setModalAberto(false); 
      setForm(formPadrao);
      setEditId(null);
      carregar();
    } catch (e) { 
      console.error(e); 
      setErroSalvar('Não foi possível salvar o lançamento — tente novamente');
    } finally {
      setSalvando(false);
    }
  }

  async function apagarLancamento(id: string) {
    if (!window.confirm('Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.')) return;
    setApagando(id);
    try {
      await api.delete(`/financeiro/${id}`);
      carregar();
    } catch (e) {
      console.error(e);
      alert('Erro ao excluir o lançamento. Tente novamente.');
    } finally {
      setApagando(null);
    }
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const maxGrafico = Math.max(...grafico.map(d => Math.max(d.entradas, d.saidas)), 1);

  let previaComissao = 0;
  let previaLiquido = 0;
  if (form.tipo === 'ENTRADA' && form.barbeiroId && form.valor) {
    const barbeiroSelecionado = barbeiros.find(b => b.id === form.barbeiroId);
    if (barbeiroSelecionado) {
      previaComissao = (Number(form.valor) * barbeiroSelecionado.comissaoPercent) / 100;
      previaLiquido = Number(form.valor) - previaComissao;
    }
  }

  if (carregando) return <SkeletonPage />;

  const lancamentosFiltrados = lancamentos.filter(l => {
    if (filtroCategoria === 'SERVICOS') return l.categoria !== 'Venda de Produto' && l.tipo === 'ENTRADA';
    if (filtroCategoria === 'PRODUTOS') return l.categoria === 'Venda de Produto' && l.tipo === 'ENTRADA';
    if (filtroCategoria === 'SAIDAS') return l.tipo === 'SAIDA';
    return true;
  });

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1
          style={{
            fontFamily: 'var(--fonte-interface)',
            fontSize: '32px',
            color: 'var(--text-primary)',
            letterSpacing: '0.04em',
          }}
        >
          Financeiro
        </h1>
        <button onClick={() => abrirModal()} className="btn-primary" disabled={carregando}>
          <Plus size={14} strokeWidth={1.5} /> Lançamento
        </button>
      </div>

      {/* Resumo do dia */}
      <div className="dashboard-grid">
        <div className="metric-card" style={{ borderLeft: '2px solid var(--success-text)' }}>
          <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--success-text)' }}>
            <TrendingUp size={14} strokeWidth={1.5} />
            <span className="metric-label !mt-0  tracking-widest" style={{ color: 'var(--success-text)' }}>Serviços</span>
          </div>
          <p className="metric-value">{fmt(resumo?.entradasServicos || 0)}</p>
        </div>
        <div className="metric-card" style={{ borderLeft: '2px solid var(--success-text)' }}>
          <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--success-text)' }}>
            <TrendingUp size={14} strokeWidth={1.5} />
            <span className="metric-label !mt-0  tracking-widest" style={{ color: 'var(--success-text)' }}>Produtos</span>
          </div>
          <p className="metric-value">{fmt(resumo?.entradasProdutos || 0)}</p>
        </div>
        <div className="metric-card" style={{ borderLeft: '2px solid var(--error-text)' }}>
          <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--error-text)' }}>
            <TrendingDown size={14} strokeWidth={1.5} />
            <span className="metric-label !mt-0  tracking-widest" style={{ color: 'var(--error-text)' }}>Saídas</span>
          </div>
          <p className="metric-value">{fmt(resumo?.totalSaidas || 0)}</p>
        </div>
        <div className="metric-card" style={{ borderLeft: '2px solid var(--amber)' }}>
          <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--cor-icone)' }}>
            <span className="metric-label !mt-0  tracking-widest">Saldo</span>
          </div>
          <p className="metric-value">{fmt(resumo?.saldo || 0)}</p>
          {resumo?.porFormaPagamento && (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {Object.entries(resumo.porFormaPagamento).map(([k, v]) => (
                <div key={k} className="flex justify-between" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{labelsForma[k] || k}</span>
                  <span style={{ color: 'var(--text-primary)' }}>{fmt(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mini gráfico 7 dias */}
      <div className="card">
        <h3 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
          Últimos 7 dias
        </h3>
        <div className="flex items-end gap-2 h-32">
          {grafico.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full flex gap-1 items-end justify-center h-24">
                <div
                  style={{ width: '12px', background: 'var(--amber)', height: `${(d.entradas / maxGrafico) * 100}%` }}
                  title={`Entradas: ${fmt(d.entradas)}`}
                />
                <div
                  style={{ width: '12px', background: 'var(--bg-surface2)', height: `${(d.saidas / maxGrafico) * 100}%` }}
                  title={`Saídas: ${fmt(d.saidas)}`}
                />
              </div>
              <span style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '9px', color: 'var(--text-muted)' }}>
                {new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-4">
          <div className="flex items-center gap-1.5"><div style={{ width: '10px', height: '10px', background: 'var(--amber)' }} /><span className="metric-label !mt-0  tracking-widest">Entradas</span></div>
          <div className="flex items-center gap-1.5"><div style={{ width: '10px', height: '10px', background: 'var(--bg-surface2)' }} /><span className="metric-label !mt-0  tracking-widest">Saídas</span></div>
        </div>
      </div>

      {/* Lançamentos do dia */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Lançamentos de Hoje
          </h3>
          <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} className="ds-select" style={{ width: 'auto', padding: '4px 8px', fontSize: '11px', minHeight: 'auto' }}>
            <option value="TODAS">Todos</option>
            <option value="SERVICOS">Apenas Serviços</option>
            <option value="PRODUTOS">Apenas Produtos</option>
            <option value="SAIDAS">Apenas Saídas</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {lancamentosFiltrados.map((l, i) => (
            <div
              key={l.id}
              className="flex items-center justify-between transition-colors"
              style={{
                padding: '1rem 1.25rem',
                borderBottom: i < lancamentos.length - 1 ? '1px solid var(--border)' : 'none',
                background: 'transparent'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-surface2)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div className="flex items-center gap-3">
                <div style={{ width: '8px', height: '8px', background: l.tipo === 'ENTRADA' ? 'var(--success-text)' : 'var(--error-text)' }} />
                <div>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{l.categoria}</p>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {l.servico ? `${l.servico.nome}` : l.descricao} 
                    {l.barbeiro && ` • ${l.barbeiro.usuario.nome}`}
                  </p>
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                <div>
                  <p style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '14px', fontWeight: 500, color: l.tipo === 'ENTRADA' ? 'var(--success-text)' : 'var(--error-text)' }}>
                    {l.tipo === 'ENTRADA' ? '+' : '-'} {fmt(Number(l.valor))}
                  </p>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '9px', letterSpacing: '0.04em', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {labelsForma[l.formaPagamento] || l.formaPagamento}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => abrirModal(l)} 
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }} 
                    title="Editar"
                    disabled={apagando === l.id}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    onClick={() => apagarLancamento(l.id)} 
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--error-text)', padding: '4px', opacity: apagando === l.id ? 0.5 : 1 }} 
                    title="Excluir"
                    disabled={apagando === l.id}
                  >
                    {apagando === l.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {lancamentosFiltrados.length === 0 && (
            <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--fonte-interface)', fontSize: '11px' }}>
              Nenhum lançamento encontrado
            </p>
          )}
        </div>
      </div>

      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo={editId ? "Editar Lançamento" : "Novo Lançamento"}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {erroSalvar && (
            <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error-text)', borderRadius: '6px', color: 'var(--error-text)', fontFamily: 'var(--fonte-interface)', fontSize: '13px', fontWeight: 500 }}>
              {erroSalvar}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(['ENTRADA', 'SAIDA'] as const).map(t => {
              const isSelected = form.tipo === t;
              const activeColor = t === 'ENTRADA' ? 'var(--success-text)' : 'var(--error-text)';
              return (
                <button
                  key={t}
                  onClick={() => setForm({...form, tipo: t})}
                  style={{
                    padding: '8px',
                    fontFamily: 'var(--fonte-interface)',
                    fontSize: '11px',
                    letterSpacing: '0.1em',
                    textTransform: '',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--bg-surface2)' : 'transparent',
                    border: `1px solid ${isSelected ? activeColor : 'var(--border)'}`,
                    color: isSelected ? activeColor : 'var(--text-muted)',
                    transition: 'all 0.2s',
                  }}
                >
                  {t === 'ENTRADA' ? 'Entrada' : 'Saída'}
                </button>
              );
            })}
          </div>

          {form.tipo === 'ENTRADA' && (
            <>
              <div>
                <label className="input-label">Serviço (Opcional)</label>
                <select value={form.servicoId} onChange={e => setForm({...form, servicoId: e.target.value})} className="ds-select">
                  <option value="">Selecione um serviço...</option>
                  {servicos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Barbeiro (Opcional)</label>
                <select value={form.barbeiroId} onChange={e => setForm({...form, barbeiroId: e.target.value})} className="ds-select">
                  <option value="">Selecione um barbeiro...</option>
                  {barbeiros.map(b => <option key={b.id} value={b.id}>{b.usuario.nome}</option>)}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="input-label">Categoria</label>
            <input value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} placeholder="Ex: Serviço Prestado, Produto, Conta de Luz" className="ds-input" />
          </div>

          <div>
            <label className="input-label">Descrição / Observação</label>
            <input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} placeholder="Opcional" className="ds-input" />
          </div>

          <div>
            <label className="input-label">Valor (R$)</label>
            <input type="number" step="0.01" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} className="ds-input" />
          </div>

          {form.tipo === 'ENTRADA' && form.barbeiroId && form.valor && (
            <div style={{ padding: '12px', background: 'var(--bg-surface2)', border: '1px solid var(--border)', fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <p>Comissão do Barbeiro: <strong style={{ color: 'var(--cor-icone)' }}>{fmt(previaComissao)}</strong></p>
              <p>Líquido Barbearia: <strong style={{ color: 'var(--success-text)' }}>{fmt(previaLiquido)}</strong></p>
            </div>
          )}

          <div>
            <label className="input-label">Forma de Pagamento</label>
            <select value={form.formaPagamento} onChange={e => setForm({...form, formaPagamento: e.target.value})} className="ds-select">
              {formasPagamento.map(f => <option key={f} value={f}>{labelsForma[f]}</option>)}
            </select>
          </div>

          <div>
            <label className="input-label">Data</label>
            <input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} className="ds-input" />
          </div>

          <button 
            onClick={salvarLancamento} 
            className="btn-primary w-full justify-center" 
            disabled={salvando}
            style={{ 
              opacity: salvando ? 0.7 : 1, 
              cursor: salvando ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {salvando && <Loader2 size={14} className="animate-spin" />}
            {salvando ? 'Salvando...' : 'Registrar'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
