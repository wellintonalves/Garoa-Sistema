// Página de Estoque — gestão completa de produtos com vendas
import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Pencil, Check, X, ShoppingCart, Package,
  TrendingUp, AlertTriangle, DollarSign, BarChart2, Calendar,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import api from '../api/client';

// ─── Tipos ─────────────────────────────────────────────────────────────────

interface ItemEstoque {
  id: string;
  nome: string;
  quantidade: number;
  unidade: string;
  quantidadeMinima: number;
  custo: string;
  precoVenda: string | null;
}

interface KPIs {
  valorCusto: number;
  valorVenda: number;
  lucroEstimado: number;
  totalItens: number;
  alertas: number;
}

interface Venda {
  id: string;
  nomeProduto: string;
  quantidade: number;
  precoVenda: string;
  custoUnitario: string;
  lucro: string;
  formaPagamento: string;
  data: string;
  estoque?: { nome: string; unidade: string } | null;
}

interface ResumoVendas {
  vendas: Venda[];
  totalReceita: number;
  totalCusto: number;
  totalLucro: number;
  totalUnidades: number;
  rankingProdutos: { nome: string; unidades: number; receita: number; lucro: number }[];
}

// ─── Constantes ────────────────────────────────────────────────────────────

const FORMAS_PAG = ['DINHEIRO', 'PIX', 'CARTAO_DEBITO', 'CARTAO_CREDITO'] as const;
type FormaPagamento = typeof FORMAS_PAG[number];

const LABEL_FORMA: Record<string, string> = {
  DINHEIRO: 'Dinheiro',
  PIX: 'Pix',
  CARTAO_DEBITO: 'Cartão Débito',
  CARTAO_CREDITO: 'Cartão Crédito',
};

// ─── Helpers ───────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function margem(custo: string | number, venda: string | null | undefined): string {
  if (!venda) return '—';
  const c = Number(custo);
  const v = Number(venda);
  if (c <= 0 || v <= 0) return '—';
  return (((v - c) / c) * 100).toFixed(0) + '%';
}

// ─── Componente ────────────────────────────────────────────────────────────

export function Estoque() {
  // Dados
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [resumoVendas, setResumoVendas] = useState<ResumoVendas | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [carregandoVendas, setCarregandoVendas] = useState(false);

  // Tabs
  const [aba, setAba] = useState<'estoque' | 'vendas'>('estoque');

  // Edição inline de quantidade
  const [editandoQtdId, setEditandoQtdId] = useState<string | null>(null);
  const [editQtd, setEditQtd] = useState('');

  // Modal de criar/editar produto
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoProduto, setEditandoProduto] = useState<ItemEstoque | null>(null);
  const formVazio = { nome: '', quantidade: '', unidade: 'unidade', quantidadeMinima: '5', custo: '', precoVenda: '' };
  const [form, setForm] = useState(formVazio);

  // Modal de venda
  const [modalVenda, setModalVenda] = useState<ItemEstoque | null>(null);
  const [qtdVenda, setQtdVenda] = useState('1');
  const [formaPag, setFormaPag] = useState<FormaPagamento>('PIX');
  const [vendendo, setVendendo] = useState(false);

  // Filtro de período para vendas
  const hoje = new Date().toISOString().split('T')[0];
  const primeiroDia = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const [periodoInicio, setPeriodoInicio] = useState(primeiroDia);
  const [periodoFim, setPeriodoFim] = useState(hoje);

  // ─── Loaders ─────────────────────────────────────────────────────────────

  const carregarEstoque = useCallback(async () => {
    try {
      const [itemsRes, kpisRes] = await Promise.all([
        api.get<ItemEstoque[]>('/estoque'),
        api.get<KPIs>('/estoque/kpis'),
      ]);
      setItens(itemsRes.data);
      setKpis(kpisRes.data);
    } catch (e) { console.error(e); }
    finally { setCarregando(false); }
  }, []);

  const carregarVendas = useCallback(async () => {
    setCarregandoVendas(true);
    try {
      const r = await api.get<ResumoVendas>('/estoque/vendas', {
        params: { inicio: periodoInicio, fim: periodoFim },
      });
      setResumoVendas(r.data);
    } catch (e) { console.error(e); }
    finally { setCarregandoVendas(false); }
  }, [periodoInicio, periodoFim]);

  useEffect(() => { carregarEstoque(); }, [carregarEstoque]);
  useEffect(() => { if (aba === 'vendas') carregarVendas(); }, [aba, carregarVendas]);

  // ─── Ações de estoque ────────────────────────────────────────────────────

  async function salvarQtd(id: string) {
    try {
      await api.put(`/estoque/${id}`, { quantidade: Number(editQtd) });
      setEditandoQtdId(null);
      carregarEstoque();
    } catch (e) { console.error(e); }
  }

  function abrirModalNovo() {
    setEditandoProduto(null);
    setForm(formVazio);
    setModalAberto(true);
  }

  function abrirModalEditar(item: ItemEstoque) {
    setEditandoProduto(item);
    setForm({
      nome: item.nome,
      quantidade: String(item.quantidade),
      unidade: item.unidade,
      quantidadeMinima: String(item.quantidadeMinima),
      custo: item.custo,
      precoVenda: item.precoVenda ?? '',
    });
    setModalAberto(true);
  }

  async function salvarProduto() {
    try {
      const payload = {
        nome: form.nome,
        quantidade: Number(form.quantidade),
        unidade: form.unidade,
        quantidadeMinima: Number(form.quantidadeMinima),
        custo: Number(form.custo),
        precoVenda: form.precoVenda ? Number(form.precoVenda) : null,
      };
      if (editandoProduto) {
        await api.put(`/estoque/${editandoProduto.id}`, payload);
      } else {
        await api.post('/estoque', payload);
      }
      setModalAberto(false);
      carregarEstoque();
    } catch (e: any) {
      alert(e?.response?.data?.erro || 'Erro ao salvar produto');
    }
  }

  // ─── Ação de venda ───────────────────────────────────────────────────────

  function abrirVenda(item: ItemEstoque) {
    setModalVenda(item);
    setQtdVenda('1');
    setFormaPag('PIX');
  }

  async function confirmarVenda() {
    if (!modalVenda) return;
    setVendendo(true);
    try {
      await api.post(`/estoque/${modalVenda.id}/vender`, {
        quantidade: Number(qtdVenda),
        formaPagamento: formaPag,
      });
      setModalVenda(null);
      carregarEstoque();
      if (aba === 'vendas') carregarVendas();
    } catch (e: any) {
      alert(e?.response?.data?.erro || 'Erro ao registrar venda');
    } finally {
      setVendendo(false);
    }
  }

  // ─── Cálculos do modal de venda ──────────────────────────────────────────

  const qtdNum = Number(qtdVenda) || 0;
  const totalVenda = modalVenda?.precoVenda ? Number(modalVenda.precoVenda) * qtdNum : 0;
  const totalCustoVenda = modalVenda ? Number(modalVenda.custo) * qtdNum : 0;
  const lucroVenda = totalVenda - totalCustoVenda;

  // ─── Render ──────────────────────────────────────────────────────────────

  if (carregando) return <LoadingSpinner />;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '32px', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
          Estoque
        </h1>
        <button onClick={abrirModalNovo} className="btn-primary">
          <Plus size={14} strokeWidth={1.5} /> Novo Produto
        </button>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
          <KpiCard
            icon={<Package size={16} strokeWidth={1.5} />}
            label="Valor em Estoque"
            valor={fmt(kpis.valorCusto)}
            sub="custo total dos produtos"
            cor="var(--text-muted)"
          />
          <KpiCard
            icon={<DollarSign size={16} strokeWidth={1.5} />}
            label="Receita Potencial"
            valor={fmt(kpis.valorVenda)}
            sub="se vender tudo em estoque"
            cor="var(--amber)"
          />
          <KpiCard
            icon={<TrendingUp size={16} strokeWidth={1.5} />}
            label="Lucro Estimado"
            valor={fmt(kpis.lucroEstimado)}
            sub="receita potencial – custo"
            cor="var(--success-text)"
          />
          <KpiCard
            icon={<AlertTriangle size={16} strokeWidth={1.5} />}
            label="Alertas"
            valor={String(kpis.alertas)}
            sub={kpis.alertas === 1 ? 'produto abaixo do mínimo' : 'produtos abaixo do mínimo'}
            cor={kpis.alertas > 0 ? '#ef4444' : 'var(--text-muted)'}
          />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
        {([['estoque', 'Produtos'], ['vendas', 'Histórico de Vendas']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            style={{
              padding: '8px 18px',
              background: 'none',
              border: 'none',
              borderBottom: aba === id ? '2px solid var(--amber)' : '2px solid transparent',
              color: aba === id ? 'var(--text-primary)' : 'var(--text-muted)',
              fontFamily: 'var(--fonte-interface)',
              fontSize: '12px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              marginBottom: '-1px',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── ABA: PRODUTOS ─────────────────────────────────────────────────── */}
      {aba === 'estoque' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrapper overflow-x-auto">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Qtd</th>
                  <th>Mín</th>
                  <th>Custo Unit.</th>
                  <th>Preço Venda</th>
                  <th>Margem</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', fontFamily: 'var(--fonte-interface)', fontSize: '12px' }}>
                      Nenhum produto cadastrado
                    </td>
                  </tr>
                )}
                {itens.map(item => {
                  const baixo = item.quantidade <= item.quantidadeMinima;
                  const semPreco = !item.precoVenda;
                  return (
                    <tr key={item.id} style={{ background: baixo ? 'rgba(226, 75, 74, 0.05)' : 'transparent' }}>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.nome}</td>
                      <td>
                        {editandoQtdId === item.id ? (
                          <input
                            type="number"
                            value={editQtd}
                            onChange={e => setEditQtd(e.target.value)}
                            className="ds-input"
                            style={{ width: '80px', minHeight: '32px', padding: '6px 8px' }}
                          />
                        ) : (
                          <span style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '12px', color: baixo ? '#ef4444' : 'var(--text-primary)' }}>
                            {item.quantidade} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{item.unidade}</span>
                          </span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '11px', color: 'var(--text-muted)' }}>{item.quantidadeMinima}</td>
                      <td style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '12px', color: 'var(--text-muted)' }}>
                        {fmt(Number(item.custo))}
                      </td>
                      <td style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '12px', color: semPreco ? 'var(--text-disabled)' : 'var(--amber)' }}>
                        {item.precoVenda ? fmt(Number(item.precoVenda)) : '—'}
                      </td>
                      <td style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '12px', color: 'var(--success-text)' }}>
                        {margem(item.custo, item.precoVenda)}
                      </td>
                      <td>
                        {baixo
                          ? <span className="badge badge-cancelled">Baixo</span>
                          : <span className="badge badge-confirmed">OK</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="flex items-center justify-end gap-1">
                          {editandoQtdId === item.id ? (
                            <>
                              <IconBtn onClick={() => salvarQtd(item.id)} color="var(--success-text)" title="Salvar">
                                <Check size={14} strokeWidth={1.5} />
                              </IconBtn>
                              <IconBtn onClick={() => setEditandoQtdId(null)} color="#ef4444" title="Cancelar">
                                <X size={14} strokeWidth={1.5} />
                              </IconBtn>
                            </>
                          ) : (
                            <>
                              <IconBtn
                                onClick={() => { setEditandoQtdId(item.id); setEditQtd(String(item.quantidade)); }}
                                color="var(--text-muted)"
                                title="Ajustar quantidade"
                              >
                                <Pencil size={13} strokeWidth={1.5} />
                              </IconBtn>
                              <IconBtn onClick={() => abrirModalEditar(item)} color="var(--text-muted)" title="Editar produto">
                                <BarChart2 size={13} strokeWidth={1.5} />
                              </IconBtn>
                              <IconBtn
                                onClick={() => abrirVenda(item)}
                                color={semPreco || item.quantidade === 0 ? 'var(--text-muted)' : 'var(--amber)'}
                                title={semPreco ? 'Cadastre um preço de venda' : item.quantidade === 0 ? 'Sem estoque' : 'Registrar venda'}
                                disabled={semPreco || item.quantidade === 0}
                              >
                                <ShoppingCart size={13} strokeWidth={1.5} />
                              </IconBtn>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ABA: VENDAS ───────────────────────────────────────────────────── */}
      {aba === 'vendas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filtro de período */}
          <div className="card">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="input-label">De</label>
                <input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} className="ds-input" style={{ width: '138px' }} />
              </div>
              <div>
                <label className="input-label">Até</label>
                <input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} className="ds-input" style={{ width: '138px' }} />
              </div>
              <button onClick={carregarVendas} className="btn-primary flex items-center gap-1 px-4">
                <Calendar size={13} strokeWidth={1.5} /> Buscar
              </button>
            </div>
          </div>

          {carregandoVendas ? <LoadingSpinner /> : resumoVendas && (
            <>
              {/* KPIs de vendas */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                <KpiCard icon={<DollarSign size={16} strokeWidth={1.5} />} label="Receita no Período" valor={fmt(resumoVendas.totalReceita)} sub={`${resumoVendas.totalUnidades} unidades vendidas`} cor="var(--amber)" />
                <KpiCard icon={<Package size={16} strokeWidth={1.5} />} label="Custo Total" valor={fmt(resumoVendas.totalCusto)} sub="custo dos produtos vendidos" cor="var(--text-muted)" />
                <KpiCard icon={<TrendingUp size={16} strokeWidth={1.5} />} label="Lucro Líquido" valor={fmt(resumoVendas.totalLucro)} sub="receita − custo" cor="var(--success-text)" />
              </div>

              {/* Ranking */}
              {resumoVendas.rankingProdutos.length > 0 && (
                <div className="card">
                  <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Mais Vendidos
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {resumoVendas.rankingProdutos.slice(0, 5).map((p, i) => (
                      <div key={i} className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <div>
                          <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>{p.nome}</span>
                          <span style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>{p.unidades} un.</span>
                        </div>
                        <div className="flex gap-4" style={{ textAlign: 'right' }}>
                          <span style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '12px', color: 'var(--amber)' }}>{fmt(p.receita)}</span>
                          <span style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '12px', color: 'var(--success-text)' }}>{fmt(p.lucro)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Histórico tabela */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-wrapper overflow-x-auto">
                  <table className="ds-table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Produto</th>
                        <th>Qtd</th>
                        <th>Preço Unit.</th>
                        <th>Total</th>
                        <th>Lucro</th>
                        <th>Pagamento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumoVendas.vendas.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', fontFamily: 'var(--fonte-interface)', fontSize: '12px' }}>
                            Nenhuma venda no período
                          </td>
                        </tr>
                      )}
                      {resumoVendas.vendas.map(v => (
                        <tr key={v.id}>
                          <td style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {new Date(v.data).toLocaleDateString('pt-BR')}
                          </td>
                          <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{v.nomeProduto}</td>
                          <td style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '12px' }}>{v.quantidade}</td>
                          <td style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '12px', color: 'var(--text-muted)' }}>{fmt(Number(v.precoVenda))}</td>
                          <td style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '12px', color: 'var(--amber)' }}>
                            {fmt(Number(v.precoVenda) * v.quantidade)}
                          </td>
                          <td style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '12px', color: 'var(--success-text)' }}>
                            {fmt(Number(v.lucro))}
                          </td>
                          <td style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--text-muted)' }}>
                            {LABEL_FORMA[v.formaPagamento] ?? v.formaPagamento}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Modal Criar/Editar Produto ────────────────────────────────────── */}
      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo={editandoProduto ? 'Editar Produto' : 'Novo Produto'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="input-label">Nome</label>
            <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} className="ds-input" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Quantidade</label>
              <input type="number" value={form.quantidade} onChange={e => setForm({ ...form, quantidade: e.target.value })} className="ds-input" />
            </div>
            <div>
              <label className="input-label">Unidade</label>
              <input value={form.unidade} onChange={e => setForm({ ...form, unidade: e.target.value })} placeholder="unidade, ml, g…" className="ds-input" />
            </div>
          </div>
          <div>
            <label className="input-label">Qtd. Mínima para alerta</label>
            <input type="number" value={form.quantidadeMinima} onChange={e => setForm({ ...form, quantidadeMinima: e.target.value })} className="ds-input" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Custo Unitário (R$)</label>
              <input type="number" step="0.01" value={form.custo} onChange={e => setForm({ ...form, custo: e.target.value })} className="ds-input" />
            </div>
            <div>
              <label className="input-label">Preço de Venda (R$)</label>
              <input type="number" step="0.01" value={form.precoVenda} onChange={e => setForm({ ...form, precoVenda: e.target.value })} placeholder="Opcional" className="ds-input" />
            </div>
          </div>
          {form.custo && form.precoVenda && (
            <div style={{ background: 'var(--bg-surface2)', borderRadius: '6px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--text-muted)' }}>Margem estimada</span>
              <span style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '13px', color: 'var(--success-text)', fontWeight: 600 }}>
                {margem(form.custo, form.precoVenda)}
              </span>
            </div>
          )}
          <button onClick={salvarProduto} className="btn-primary w-full justify-center">
            {editandoProduto ? 'Salvar Alterações' : 'Cadastrar'}
          </button>
        </div>
      </Modal>

      {/* ── Modal Vender ─────────────────────────────────────────────────── */}
      <Modal aberto={!!modalVenda} onFechar={() => setModalVenda(null)} titulo="Registrar Venda">
        {modalVenda && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Info do produto */}
            <div style={{ background: 'var(--bg-surface2)', borderRadius: '8px', padding: '12px 16px' }}>
              <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                {modalVenda.nome}
              </p>
              <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--text-muted)' }}>
                Disponível: <strong style={{ color: 'var(--text-secondary)' }}>{modalVenda.quantidade} {modalVenda.unidade}</strong>
                {' · '}Preço: <strong style={{ color: 'var(--amber)' }}>{fmt(Number(modalVenda.precoVenda))}</strong>
              </p>
            </div>

            {/* Quantidade */}
            <div>
              <label className="input-label">Quantidade a vender</label>
              <input
                type="number"
                min="1"
                max={modalVenda.quantidade}
                value={qtdVenda}
                onChange={e => setQtdVenda(e.target.value)}
                className="ds-input"
              />
            </div>

            {/* Forma de pagamento */}
            <div>
              <label className="input-label">Forma de Pagamento</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {FORMAS_PAG.map(f => (
                  <button
                    key={f}
                    onClick={() => setFormaPag(f)}
                    style={{
                      padding: '10px',
                      borderRadius: '6px',
                      border: formaPag === f ? '1.5px solid var(--amber)' : '1px solid var(--border)',
                      background: formaPag === f ? 'rgba(255,140,0,0.08)' : 'var(--bg-surface2)',
                      color: formaPag === f ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontFamily: 'var(--fonte-interface)',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {LABEL_FORMA[f]}
                  </button>
                ))}
              </div>
            </div>

            {/* Resumo financeiro */}
            {qtdNum > 0 && (
              <div style={{ background: 'var(--bg-surface2)', borderRadius: '8px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <SumRow label="Total da venda" valor={fmt(totalVenda)} cor="var(--amber)" />
                <SumRow label="Custo estimado" valor={fmt(totalCustoVenda)} cor="var(--text-muted)" />
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
                  <SumRow label="Lucro" valor={fmt(lucroVenda)} cor="var(--success-text)" bold />
                </div>
              </div>
            )}

            <button
              onClick={confirmarVenda}
              disabled={vendendo || qtdNum <= 0 || qtdNum > modalVenda.quantidade}
              className="btn-primary w-full justify-center"
              style={{ opacity: vendendo ? 0.6 : 1 }}
            >
              {vendendo ? 'Registrando…' : `Confirmar Venda · ${fmt(totalVenda)}`}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function KpiCard({ icon, label, valor, sub, cor }: {
  icon: React.ReactNode; label: string; valor: string; sub: string; cor: string;
}) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div className="flex items-center gap-2">
        <span style={{ color: cor }}>{icon}</span>
        <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          {label}
        </span>
      </div>
      <p style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '22px', fontWeight: 700, color: cor, lineHeight: 1 }}>
        {valor}
      </p>
      <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-muted)' }}>{sub}</p>
    </div>
  );
}

function IconBtn({ onClick, color, title, children, disabled }: {
  onClick: () => void; color: string; title: string; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        width: '28px', height: '28px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 'none', cursor: disabled ? 'default' : 'pointer',
        color: disabled ? 'var(--text-muted)' : color, opacity: disabled ? 0.35 : 1,
        borderRadius: '4px',
      }}
    >
      {children}
    </button>
  );
}

function SumRow({ label, valor, cor, bold }: { label: string; valor: string; cor: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '13px', color: cor, fontWeight: bold ? 700 : 500 }}>{valor}</span>
    </div>
  );
}
