// Página Financeiro — industrial
import { useEffect, useState } from 'react';
import { Plus, TrendUp as TrendingUp, TrendDown as TrendingDown, PencilSimple, Trash, Spinner, CurrencyDollar } from '@phosphor-icons/react';
import { Modal } from '../components/Modal';
import { Botao } from '../components/ui/Botao';
import { SkeletonPage } from '../components/Skeleton';
import { StatCard } from '../components/StatCard';
import { BuscaCliente } from '../components/BuscaCliente';

import api from '../api/client';
import { hojeBrasilia } from '../utils/datas';
import { statusPontos, type SaldoPontos } from '../utils/statusPontos';

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
  valorBrutoOriginal?: string;
  itens?: any[];
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
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  
  const formPadrao = { 
    tipo: 'ENTRADA', categoria: '', descricao: '', valor: '', formaPagamento: 'PIX', 
    data: hojeBrasilia(), barbeiroId: '', clienteId: null as string | null,
    itens: [] as any[], tipoDesconto: 'NENHUM', valorDescontoManual: '', pontosUsados: '' 
  };
  const [form, setForm] = useState(formPadrao);
  const [fidelidade, setFidelidade] = useState<SaldoPontos | null>(null);
  const [chaveSaldoRecebido, setChaveSaldoRecebido] = useState('');
  const [tentativaFidelidade, setTentativaFidelidade] = useState(0);
  const [erroFidelidade, setErroFidelidade] = useState<string | null>(null);
  const [simulacao, setSimulacao] = useState<any>(null);
  const [erroSimulacao, setErroSimulacao] = useState<string | null>(null);
  const [chaveSimulada, setChaveSimulada] = useState('');
  const [tentativaSimulacao, setTentativaSimulacao] = useState(0);
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS');

  async function carregar() {
    try {
      const hoje = hojeBrasilia();
      const [l, r, g, b, s] = await Promise.all([
        api.get<Lancamento[]>('/financeiro', { params: { inicio: hoje, fim: hoje } }),
        api.get<ResumoDia>('/financeiro/resumo-dia', { params: { data: hoje } }),
        api.get<DadoGrafico[]>('/financeiro/ultimos-7-dias'),
        api.get<Barbeiro[]>('/barbeiros?todos=true'),
        api.get<Servico[]>('/servicos')
      ]);
      setLancamentos(l.data); setResumo(r.data); setGrafico(g.data);
      setBarbeiros(b.data.filter((bar: any) => bar.ativo)); 
      setServicos(s.data.filter((srv: any) => srv.ativo));
    } catch (e) { console.error(e); }
    finally { setCarregando(false); }
  }

  useEffect(() => { carregar(); }, []);

  const chaveSaldo = JSON.stringify([modalAberto, form.tipo, form.clienteId, form.valor, tentativaFidelidade]);
  const carregandoFidelidade = modalAberto && form.tipo === 'ENTRADA' && !!form.clienteId && chaveSaldoRecebido !== chaveSaldo;
  const disponibilidadePontos = statusPontos(form.clienteId, carregandoFidelidade, erroFidelidade, fidelidade);

  useEffect(() => {
    const controller = new AbortController();
    setChaveSaldoRecebido('');
    setFidelidade(null);
    setErroFidelidade(null);
    if (!modalAberto || form.tipo !== 'ENTRADA' || !form.clienteId) return;
    const buscar = async () => {
    try {
      // Endpoint dedicado: devolve saldoPontos, resgatePontosAtivo e maxPontosUtilizaveis
      // ja considerando o teto percentual sobre o valor do atendimento.
      // O detalhe do cliente (/clientes/:id) NAO devolve esses campos.
      const valorServico = Number(form.valor) || 0;
      // request evita compartilhar uma GET cancelada pelo StrictMode no deduplicador.
      const res = await api.request<SaldoPontos>({ method: 'GET', url: `/fidelidade/clientes/${form.clienteId}/saldo`,
        params: { valorServico },
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setFidelidade(res.data || null);
    } catch (err) {
      if (controller.signal.aborted) return;
      setErroFidelidade(err instanceof Error ? err.message : 'Não foi possível carregar a fidelidade.');
    } finally {
      if (!controller.signal.aborted) setChaveSaldoRecebido(chaveSaldo);
    }
    };
    void buscar();
    return () => controller.abort();
  }, [modalAberto, form.tipo, form.clienteId, form.valor, chaveSaldo]);

  useEffect(() => {
    if (!carregandoFidelidade && !disponibilidadePontos.habilitado) {
      setForm(prev => prev.tipoDesconto === 'PONTOS' ? { ...prev, tipoDesconto: 'NENHUM', pontosUsados: '' } : prev);
    }
  }, [carregandoFidelidade, disponibilidadePontos.habilitado]);

  const chaveSimulacao = JSON.stringify([modalAberto, form.tipo, form.tipoDesconto, form.valorDescontoManual, form.pontosUsados, form.clienteId, form.barbeiroId, form.itens, form.valor, tentativaSimulacao]);
  const simulando = modalAberto && form.tipo === 'ENTRADA' && chaveSimulada !== chaveSimulacao;
  const bloqueioSalvar = salvando || (form.tipo === 'ENTRADA' && (simulando || !!erroSimulacao || (form.tipoDesconto === 'PONTOS' && !disponibilidadePontos.habilitado)));

  useEffect(() => {
    const controller = new AbortController();
    setChaveSimulada('');
    setSimulacao(null);
    setErroSimulacao(null);
    if (!modalAberto || form.tipo !== 'ENTRADA') return;
    const buscarSimulacao = async () => {
    try {
      const payload = {
        tipo: 'ENTRADA',
        tipoDesconto: form.tipoDesconto,
        descontoReais: form.tipoDesconto === 'REAIS' ? Number(form.valorDescontoManual) : undefined,
        descontoPercentual: form.tipoDesconto === 'PERCENTUAL' ? Number(form.valorDescontoManual) : undefined,
        pontosUsados: form.tipoDesconto === 'PONTOS' ? Number(form.pontosUsados) : undefined,
        clienteId: form.clienteId || undefined,
        barbeiroId: form.barbeiroId || undefined,
        itens: form.itens && form.itens.length > 0 ? form.itens.map(i => ({ servicoId: i.servicoId })) : undefined,
        valor: form.valor ? Number(form.valor) : undefined
      };
      const res = await api.post('/financeiro/simular-desconto', payload, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setSimulacao(res.data);
      if (res.data.valorDesconto > res.data.valorBruto) {
         setErroSimulacao('O desconto não pode ser maior que o valor bruto.');
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setErroSimulacao(err instanceof Error ? err.message : 'Não foi possível simular o valor.');
    } finally {
      if (!controller.signal.aborted) setChaveSimulada(chaveSimulacao);
    }
  };
    const timeout = setTimeout(buscarSimulacao, 300);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [modalAberto, chaveSimulacao, form.tipo, form.tipoDesconto, form.valorDescontoManual, form.pontosUsados, form.clienteId, form.barbeiroId, form.itens, form.valor]);

  useEffect(() => {
    if (form.itens && form.itens.length > 0 && !editId) {
      const soma = form.itens.reduce((acc, item) => {
        const s = servicos.find(x => x.id === item.servicoId);
        return acc + (s ? Number(s.preco) : 0);
      }, 0);
      setForm(prev => ({ ...prev, valor: String(soma), categoria: 'Serviço Prestado', tipo: 'ENTRADA' }));
    }
  }, [form.itens, servicos, editId]);

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
        barbeiroId: lancamento.barbeiroId || '',
        clienteId: null,
        itens: lancamento.itens?.length ? lancamento.itens : (lancamento.servicoId ? [{ servicoId: lancamento.servicoId }] : []),
        tipoDesconto: 'NENHUM',
        valorDescontoManual: '',
        pontosUsados: ''
      });
    } else {
      setEditId(null);
      setForm(formPadrao);
    }
    setErroSalvar(null);
    setModalAberto(true);
  }

  async function salvarLancamento() {
    if (bloqueioSalvar) return;
    setSalvando(true);
    try {
      const payload = { 
        ...form, 
        valor: Number(form.valor),
        itens: form.itens.map(i => ({ servicoId: i.servicoId })),
        barbeiroId: form.barbeiroId || undefined,
        descontoReais: form.tipoDesconto === 'REAIS' ? Number(form.valorDescontoManual) : undefined,
        descontoPercentual: form.tipoDesconto === 'PERCENTUAL' ? Number(form.valorDescontoManual) : undefined,
        pontosUsados: form.tipoDesconto === 'PONTOS' ? Number(form.pontosUsados) : undefined
      };
      delete (payload as any).servicoId;
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
    setApagando(id);
    try {
      await api.delete(`/financeiro/${id}`);
      setConfirmandoExclusao(null);
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
          <Plus size={14} /> Lançamento
        </button>
      </div>

      {/* Resumo do dia */}
      <div className="dashboard-grid">
        <StatCard titulo="Serviços" valor={fmt(resumo?.entradasServicos || 0)} icone={TrendingUp} />
        <StatCard titulo="Produtos" valor={fmt(resumo?.entradasProdutos || 0)} icone={TrendingUp} />
        <StatCard titulo="Saídas" valor={fmt(resumo?.totalSaidas || 0)} icone={TrendingDown} alerta={true} />
        <StatCard titulo="Saldo" valor={fmt(resumo?.saldo || 0)} icone={CurrencyDollar} />
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
              <span style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '9px', color: 'var(--texto-secundario)' }}>
                {new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-4">
          <div className="flex items-center gap-1.5"><div style={{ width: '10px', height: '10px', background: 'var(--amber)' }} /><span className="metric-label !mt-0 uppercase tracking-widest">Entradas</span></div>
          <div className="flex items-center gap-1.5"><div style={{ width: '10px', height: '10px', background: 'var(--bg-surface2)' }} /><span className="metric-label !mt-0 uppercase tracking-widest">Saídas</span></div>
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
                <div style={{ width: '8px', height: '8px', background: l.tipo === 'ENTRADA' ? 'var(--sucesso)' : 'var(--error-text)' }} />
                <div>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{l.categoria}</p>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--texto-secundario)', marginTop: '2px' }}>
                    {l.servico ? `${l.servico.nome}` : l.descricao} 
                    {l.barbeiro && ` • ${l.barbeiro.usuario.nome}`}
                  </p>
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                <div>
                  <p style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '14px', fontWeight: 500, color: l.tipo === 'ENTRADA' ? 'var(--sucesso)' : 'var(--error-text)' }}>
                    {l.tipo === 'ENTRADA' ? '+' : '-'} {fmt(Number(l.valor))}
                  </p>
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '9px', letterSpacing: '0.04em', color: 'var(--texto-secundario)', marginTop: '2px' }}>
                    {labelsForma[l.formaPagamento] || l.formaPagamento}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => abrirModal(l)} 
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--texto-secundario)', padding: '4px' }} 
                    title="Editar"
                    disabled={apagando === l.id}
                  >
                    <PencilSimple size={14} />
                  </button>
                  <button 
                    onClick={() => setConfirmandoExclusao(l.id)} 
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--error-text)', padding: '4px', opacity: apagando === l.id ? 0.5 : 1 }} 
                    title="Excluir"
                    disabled={apagando === l.id}
                  >
                    {apagando === l.id ? <Spinner size={14} className="animate-spin" /> : <Trash size={14} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {lancamentosFiltrados.length === 0 && (
            <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--texto-secundario)', fontFamily: 'var(--fonte-interface)', fontSize: '11px' }}>
              Nenhum lançamento encontrado
            </p>
          )}
        </div>
      </div>

      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo={editId ? "Editar Lançamento" : "Novo Lançamento"}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {erroSalvar && (
            <div style={{ padding: '12px', background: 'var(--perigo-fundo)', border: '1px solid var(--error-text)', borderRadius: '6px', color: 'var(--error-text)', fontFamily: 'var(--fonte-interface)', fontSize: '13px', fontWeight: 500 }}>
              {erroSalvar}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(['ENTRADA', 'SAIDA'] as const).map(t => {
              const isSelected = form.tipo === t;
              const activeColor = t === 'ENTRADA' ? 'var(--sucesso)' : 'var(--error-text)';
              return (
                <button
                  key={t}
                  onClick={() => setForm({...form, tipo: t})}
                  style={{
                    padding: '8px',
                    fontFamily: 'var(--fonte-interface)',
                    fontSize: '11px',
                    letterSpacing: '0.1em',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--bg-surface2)' : 'transparent',
                    border: `1px solid ${isSelected ? activeColor : 'var(--border)'}`,
                    color: isSelected ? activeColor : 'var(--texto-secundario)',
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
              <div className="z-50 relative">
                <BuscaCliente 
                  onSelect={(id) => setForm(prev => ({ ...prev, clienteId: id,
                    ...(prev.clienteId !== id && prev.tipoDesconto === 'PONTOS' ? { tipoDesconto: 'NENHUM', pontosUsados: '' } : {})
                  }))}
                  selectedClienteId={form.clienteId} 
                />
              </div>
              <div>
                <label className="input-label mb-2 block">Serviços (Opcional)</label>
                <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-2 rounded-md border border-[var(--border)] p-3 bg-[var(--bg-surface)]">
                  {servicos.map(s => {
                    const checked = form.itens && form.itens.some((i: any) => i.servicoId === s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-2 text-sm text-[var(--text-primary)] cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          checked={checked}
                          onChange={(e) => {
                            setForm(prev => {
                              let novosItens = prev.itens ? [...prev.itens] : [];
                              if (e.target.checked) {
                                novosItens.push({ servicoId: s.id, nome: s.nome, preco: s.preco });
                              } else {
                                novosItens = novosItens.filter((i: any) => i.servicoId !== s.id);
                              }
                              return { ...prev, itens: novosItens };
                            });
                          }}
                          className="rounded border-[var(--border)] text-[var(--cor-primaria)] focus:ring-[var(--cor-primaria)] bg-[var(--bg-surface2)]"
                        />
                        <span className="flex-1">{s.nome}</span>
                        <span className="text-[var(--texto-secundario)] font-mono text-xs">{fmt(Number(s.preco))}</span>
                      </label>
                    );
                  })}
                </div>
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
          </div>          <div>
            <label className="input-label">Valor Bruto / Base (R$)</label>
            <input type="number" step="0.01" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} className="ds-input" />
          </div>

          {form.tipo === 'ENTRADA' && (
            <div>
              <label className="input-label mb-2 block">Desconto</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex flex-wrap gap-1 sm:flex-nowrap" style={{ flexShrink: 0 }}>
                  {[
                    { value: 'NENHUM', label: 'Nenhum' },
                    { value: 'REAIS', label: 'R$' },
                    { value: 'PERCENTUAL', label: '%' },
                    { value: 'PONTOS', label: 'Pontos' },
                  ].map(tipo => {
                    const isPontos = tipo.value === 'PONTOS';
                    const isLoading = isPontos && carregandoFidelidade;
                    const isDisabled = isPontos && !disponibilidadePontos.habilitado;
                    return (
                      <button
                        key={tipo.value}
                        type="button"
                        onClick={() => {
                          setForm(prev => {
                            const next = { ...prev, tipoDesconto: tipo.value };
                            if (tipo.value === 'NENHUM') { next.valorDescontoManual = ''; next.pontosUsados = ''; }
                            else if (tipo.value === 'PONTOS') { next.valorDescontoManual = ''; }
                            else { next.pontosUsados = ''; }
                            return next;
                          });
                        }}
                        disabled={!!isDisabled}
                        title={isPontos ? disponibilidadePontos.motivo ?? undefined : undefined}
                        aria-describedby={isPontos ? 'motivo-pontos' : undefined}
                        style={{ minHeight: 48, fontSize: 13, opacity: isDisabled ? 0.6 : 1 }}
                        className={`px-3 py-2 rounded-md text-xs font-medium transition-colors border flex items-center gap-1 ${
                          form.tipoDesconto === tipo.value 
                          ? 'bg-[var(--cor-primaria)] text-[var(--texto-sobre-primaria)] border-[var(--cor-primaria)]' 
                          : 'bg-transparent text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--bg-surface2)]'
                        }`}
                      >
                        {isLoading && <Spinner className="animate-spin" size={14} />}
                        {tipo.label}
                      </button>
                    );
                  })}
                </div>
                
                {form.tipoDesconto === 'PONTOS' ? (
                  <div className="flex-1 flex flex-col justify-center">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      max={fidelidade?.maxPontosUtilizaveis}
                      disabled={carregandoFidelidade}
                      value={form.pontosUsados}
                      onChange={e => setForm({...form, pontosUsados: e.target.value})}
                      placeholder="Pontos"
                      className="ds-input py-2"
                    />
                    {fidelidade && !carregandoFidelidade && (
                      <span className="text-[13px] text-[var(--texto-secundario)] mt-1 ml-1">
                        Saldo: {fidelidade.saldoPontos} pts (máx {fidelidade.maxPontosUtilizaveis})
                      </span>
                    )}
                  </div>
                ) : form.tipoDesconto !== 'NENHUM' ? (
                  <div className="flex-1">
                    <input
                      type="number"
                      step={form.tipoDesconto === 'REAIS' ? "0.01" : "1"}
                      value={form.valorDescontoManual}
                      onChange={e => setForm({...form, valorDescontoManual: e.target.value})}
                      placeholder={form.tipoDesconto === 'REAIS' ? '0,00' : '0%'}
                      className="ds-input py-2"
                    />
                  </div>
                ) : <div className="flex-1" />}
              </div>
              <p id="motivo-pontos" role="status" style={{ fontSize: 13, color: 'var(--texto-secundario)', marginTop: 8 }}>
                {disponibilidadePontos.motivo}
              </p>
              {erroFidelidade && !carregandoFidelidade && form.clienteId && (
                <button type="button" className="btn-secondary" onClick={() => setTentativaFidelidade(t => t + 1)}>Tentar carregar pontos novamente</button>
              )}
            </div>
          )}

          {form.tipo === 'ENTRADA' && (form.valor || erroSimulacao) && (
            <div style={{ padding: '12px', background: 'var(--bg-surface2)', border: '1px solid var(--border)', fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <p>Valor Final (a cobrar): <strong style={{ color: 'var(--text-primary)' }}>{simulando ? 'Calculando…' : erroSimulacao ? 'Indisponível' : simulacao ? fmt(simulacao.valorLiquido) : fmt(Number(form.valor || 0))}</strong></p>
              {form.barbeiroId && (
                <>
                  <p>Comissão do Barbeiro: <strong style={{ color: 'var(--cor-icone)' }}>{simulacao && !erroSimulacao ? fmt(simulacao.valorComissao) : fmt(previaComissao)}</strong></p>
                  <p>Líquido Barbearia: <strong style={{ color: 'var(--sucesso)' }}>{simulacao && !erroSimulacao ? fmt(simulacao.valorLiquido - simulacao.valorComissao) : fmt(previaLiquido)}</strong></p>
                </>
              )}
              {erroSimulacao && !simulando && <>
                <p role="alert" style={{ color: 'var(--error-text)', fontSize: 13 }}>{erroSimulacao}</p>
                <button type="button" className="btn-secondary" onClick={() => setTentativaSimulacao(t => t + 1)}>Tentar calcular novamente</button>
              </>}
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
            disabled={bloqueioSalvar}
            style={{ 
              opacity: salvando ? 0.7 : 1, 
              cursor: salvando ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {salvando && <Spinner size={14} className="animate-spin" />}
            {salvando ? 'Salvando...' : simulando ? 'Calculando...' : 'Registrar'}
          </button>
        </div>
      </Modal>

      <Modal aberto={!!confirmandoExclusao} onFechar={() => setConfirmandoExclusao(null)} titulo="Excluir Lançamento">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Tem certeza que deseja excluir este lançamento?
            <br />Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-3 justify-end">
            <Botao
              variante="fantasma"
              onClick={() => setConfirmandoExclusao(null)}
            >
              Cancelar
            </Botao>
            <Botao
              variante="destrutivo"
              onClick={() => confirmandoExclusao && apagarLancamento(confirmandoExclusao)}
            >
              Excluir
            </Botao>
          </div>
        </div>
      </Modal>
    </div>
  );
}
