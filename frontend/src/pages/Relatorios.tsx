import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CurrencyDollar, Users, Scissors, TrendUp as TrendingUp, WarningCircle, PencilSimple, X, Trash, Plus } from '@phosphor-icons/react';
import { Modal } from '../components/Modal';
import { Botao } from '../components/ui/Botao';
import { SkeletonTable } from '../components/Skeleton';
import { StatCard } from '../components/StatCard';
import api from '../api/client';
import { validarPeriodoRelatorio } from '../utils/periodoRelatorio';
import { dataBrasilia, hojeBrasilia } from '../utils/datas';

type Natureza = 'todos' | 'produtos' | 'servicos';

interface Consolidado {
  totalBruto: number;
  totalProdutos: number;
  totalComissoes: number;
  totalLiquido: number;
  totalAtendimentos: number;
  porBarbeiro: Record<string, { nome: string; bruto: number; comissao: number; liquido: number; percentualAplicado?: number | null; lancamentosDivergentes?: number; lancamentosSemBaseAuditavel?: number }>;
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
  servicoId?: string | null;
  barbeiroId?: string | null;
  itens?: { nome: string }[];
}

interface RelatorioData {
  produtosSemDetalhamento?: number;
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
  const [carregando, setCarregando] = useState(true);
  const [barbeiros, setBarbeiros] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<{ id: string; nome: string }[]>([]);
  const [erroProdutos, setErroProdutos] = useState(false);
  const [carregandoProdutos, setCarregandoProdutos] = useState(true);
  const [revisaoProdutos, setRevisaoProdutos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  const dataHoje = hojeBrasilia();
  const [year, month] = dataHoje.split('-').map(Number);
  const dataPrimeiroDia = dataBrasilia(new Date(year, month - 1, 1, 12, 0, 0));

  const barbeiroIdUrl = searchParams.get('barbeiroId') || 'todos';
  const [filtros, setFiltros] = useState({ inicio: dataPrimeiroDia, fim: dataHoje, barbeiroId: barbeiroIdUrl, natureza: 'todos' as Natureza, pagamento: 'todos', produtoId: 'todos' });
  const periodoAnterior = useRef(`${filtros.inicio}|${filtros.fim}`);
  const [revisao, setRevisao] = useState(0);
  const buscarRelatorio = () => {
    setRevisao(valor => valor + 1);
  };
  const [versaoPeriodo, setVersaoPeriodo] = useState(0);
  const limparFiltros = () => {
    setFiltros({ inicio: '', fim: '', natureza: 'todos', barbeiroId: 'todos', produtoId: 'todos', pagamento: 'todos' });
    // O campo nativo pode manter segmentos digitados mesmo com value vazio.
    setVersaoPeriodo(valor => valor + 1);
  };
  const erroPeriodo = validarPeriodoRelatorio(filtros.inicio, filtros.fim);
  const chaveConsulta = JSON.stringify([filtros, revisao]);
  const [chaveConcluida, setChaveConcluida] = useState('');
  const atualizando = !erroPeriodo && (carregando || chaveConcluida !== chaveConsulta);
  const temFiltros = !!(filtros.inicio || filtros.fim || filtros.natureza !== 'todos' || filtros.barbeiroId !== 'todos' || filtros.produtoId !== 'todos' || filtros.pagamento !== 'todos');
  const [relatorio, setRelatorio] = useState<RelatorioData | null>(null);

  // Estados para edição de lançamento
  const [lancamentoEditando, setLancamentoEditando] = useState<Lancamento | null>(null);
  const [valoresEdit, setValoresEdit] = useState({ valor: '', comissao: '', formaPagamento: '', servicoId: '' });
  const [servicosAdicionais, setServicosAdicionais] = useState<any[]>([]);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setCarregandoProdutos(true);
    setErroProdutos(false);
    api.get('/financeiro/relatorio/produtos', { signal: controller.signal })
      .then(res => { if (!controller.signal.aborted) setProdutos(res.data ?? []); })
      .catch(() => { if (!controller.signal.aborted) setErroProdutos(true); })
      .finally(() => { if (!controller.signal.aborted) setCarregandoProdutos(false); });
    return () => controller.abort();
  }, [revisaoProdutos]);

  useEffect(() => {
    const controller = new AbortController();
    async function carregar() {
      try {
        const res = await api.get('/barbeiros?todos=true', { signal: controller.signal });
        const resS = await api.get('/servicos', { signal: controller.signal });
        if (controller.signal.aborted) return;
        setServicos((resS.data ?? []).filter((s: any) => s.ativo));
        setBarbeiros(res.data);
      } catch (e) {
        if (!controller.signal.aborted) console.error('Erro ao carregar barbeiros:', e);
      }
    }
    carregar();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const periodo = `${filtros.inicio}|${filtros.fim}`;
    const dataAlterada = periodoAnterior.current !== periodo;
    periodoAnterior.current = periodo;
    if (erroPeriodo) {
      setCarregando(false);
      setRelatorio(null);
      setErro(null);
      return () => controller.abort();
    }
    setCarregando(true);
    setErro(null);
    async function carregarRelatorio() {
      setCarregando(true);
      setErro(null);
      try {
        const params: Record<string, string> = {

          natureza: filtros.natureza,
          pagamento: filtros.pagamento,
        };
        if (filtros.inicio && filtros.fim) {
          params.inicio = filtros.inicio;
          params.fim = filtros.fim;
        }
        // Só envia barbeiroId se não for "todos"
        if (filtros.natureza !== 'produtos' && filtros.barbeiroId && filtros.barbeiroId !== 'todos') {
          params.barbeiroId = filtros.barbeiroId;
        }

        if (filtros.natureza === 'produtos' && filtros.produtoId !== 'todos') params.produtoId = filtros.produtoId;

        const res = await api.get('/financeiro/relatorio', { params, signal: controller.signal });
        if (controller.signal.aborted) return;

        if (res.data && res.data.consolidado && Array.isArray(res.data.lancamentos)) {
          setRelatorio(res.data);
        } else {
          console.error('Resposta inesperada da API:', res.data);
          setErro('A API retornou dados em formato inesperado.');
          setRelatorio(null);
        }
      } catch (e: any) {
        if (controller.signal.aborted) return;
        setErro(e?.message || 'Não foi possível carregar o relatório. Tente novamente.');
        setRelatorio(null);
      } finally {
        if (!controller.signal.aborted) {
          setCarregando(false);
          setChaveConcluida(chaveConsulta);
        }
      }
    }
    // Agrupa a digitação das datas; seleções e limpar são aplicados sem espera perceptível.
    const timer = window.setTimeout(() => { void carregarRelatorio(); }, dataAlterada && filtros.inicio && filtros.fim ? 300 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [filtros, revisao, erroPeriodo, chaveConsulta]);

    const handleEditar = (l: Lancamento) => {
    setLancamentoEditando(l);
    setServicosAdicionais([]);
    setValoresEdit({
      valor: Number(l.valor).toFixed(2),
      comissao: l.valorComissao ? Number(l.valorComissao).toFixed(2) : '',
      formaPagamento: l.formaPagamento,
      servicoId: l.servicoId || '',
    });
  };

  const excluirLancamento = async (id: string) => {
    try {
      const res = await api.delete(`/financeiro/${id}`);
      setConfirmandoExclusao(null);
      if (res.data?.status === 'PENDENTE') {
        alert('Este lançamento pertence a um barbeiro. Uma solicitação de exclusão foi enviada para aprovação do barbeiro.');
      } else {
        alert('Lançamento excluído com sucesso.');
      }
      buscarRelatorio();
    } catch (e: any) {
      alert(e?.response?.data?.erro || 'Erro ao excluir.');
    }
  };

    const salvarEdicao = async () => {
    if (!lancamentoEditando) return;
    setSalvandoEdicao(true);
    try {
      const payload: any = {
        valor: Number(valoresEdit.valor),
        formaPagamento: valoresEdit.formaPagamento,
      };
      if (valoresEdit.servicoId) payload.servicoId = valoresEdit.servicoId;

      const res = await api.put(`/financeiro/${lancamentoEditando.id}`, payload);

      // Adicionar serviços extras
      for (const servicoExtra of servicosAdicionais) {
        if (!servicoExtra.servicoId) continue;
        await api.post(`/financeiro/${lancamentoEditando.id}/adicionar`, {
          tipo: 'ENTRADA',
          categoria: 'Serviço Adicional',
          descricao: '',
          valor: Number(servicoExtra.valor),
          formaPagamento: valoresEdit.formaPagamento, // Usa a mesma forma de pgto
          barbeiroId: lancamentoEditando.barbeiroId || null,
          servicoId: servicoExtra.servicoId,
          data: lancamentoEditando.data,
        });
      }

      if (res.data?.status === 'PENDENTE' || (servicosAdicionais.length > 0 && lancamentoEditando.barbeiroId)) {
        alert('As alterações que afetam barbeiros foram enviadas para aprovação.');
      } else {
        alert('Alterações salvas com sucesso.');
      }

      setLancamentoEditando(null);
      buscarRelatorio();
    } catch (e: any) {
      console.error('Erro ao editar:', e);
      alert(e?.response?.data?.erro || 'Erro ao editar lançamento.');
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const fmt = (v: number | string | null | undefined) => {
    const num = Number(v) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const entradas = (relatorio?.lancamentos ?? []).filter((l) => l.tipo === 'ENTRADA' || l.categoria === 'Estorno de Produto');

  return (
    <div className="animate-fade-in min-w-0" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <h1
        style={{
          fontFamily: 'var(--fonte-interface)',
          fontSize: '32px',
          color: 'var(--text-primary)',
          letterSpacing: '0.04em',
        }}
      >
        Relatórios e comissões
      </h1>

      {/* Filtros */}
      <form onSubmit={e => e.preventDefault()} aria-label="Filtros do relatório" className="card grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 items-end">
        <div className="min-w-0">
          <label htmlFor="relatorio-inicio" className="input-label">Data inicial</label>
          <input key={`inicio-${versaoPeriodo}`} id="relatorio-inicio" type="date" aria-invalid={!!erroPeriodo} aria-describedby={erroPeriodo ? 'relatorio-periodo' : undefined} value={filtros.inicio} onChange={e => setFiltros({...filtros, inicio: e.target.value})} className="ds-input min-h-12 w-full min-w-0" />
        </div>
        <div className="min-w-0">
          <label htmlFor="relatorio-fim" className="input-label">Data final</label>
          <input key={`fim-${versaoPeriodo}`} id="relatorio-fim" type="date" aria-invalid={!!erroPeriodo} aria-describedby={erroPeriodo ? 'relatorio-periodo' : undefined} value={filtros.fim} onChange={e => setFiltros({...filtros, fim: e.target.value})} className="ds-input min-h-12 w-full min-w-0" />
        </div>
        <div className="min-w-0">
          <label htmlFor="relatorio-natureza" className="input-label">Tipo de lançamento</label>
          <select id="relatorio-natureza" className="ds-select min-h-12 w-full min-w-0" value={filtros.natureza} onChange={e => setFiltros({ ...filtros, natureza: e.target.value as Natureza, barbeiroId: 'todos', produtoId: 'todos' })}>
            <option value="todos">Todos</option>
            <option value="produtos">Produtos</option>
            <option value="servicos">Serviços</option>
          </select>
        </div>
        <div className="min-w-0">
          {filtros.natureza === 'produtos' ? <>
            <label htmlFor="relatorio-produto" className="input-label">Produto</label>
            <select id="relatorio-produto" value={filtros.produtoId} onChange={e => setFiltros({ ...filtros, produtoId: e.target.value })} disabled={carregandoProdutos || erroProdutos} className="ds-select min-h-12 w-full min-w-0">
              <option value="todos">{carregandoProdutos ? 'Carregando produtos…' : 'Todos os produtos'}</option>
              {(produtos ?? []).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            {erroProdutos && <p role="alert" className="text-sm mt-2">Não foi possível carregar os produtos. <button type="button" className="btn-secondary min-h-12" style={{ minHeight: 48 }} onClick={() => setRevisaoProdutos(v => v + 1)}>Tentar novamente</button></p>}
          </> : <>
            <label htmlFor="relatorio-barbeiro" className="input-label">Barbeiro</label>
            <select id="relatorio-barbeiro" value={filtros.barbeiroId} onChange={e => setFiltros({ ...filtros, barbeiroId: e.target.value })} className="ds-select min-h-12 w-full min-w-0">
              <option value="todos">Todos os barbeiros</option>
              {(barbeiros ?? []).map(b => <option key={b.id} value={b.id}>{b.usuario.nome}</option>)}
            </select>
          </>}
        </div>
        <div className="min-w-0">
          <label htmlFor="relatorio-pagamento" className="input-label">Forma de pagamento</label>
          <select id="relatorio-pagamento" className="ds-select min-h-12 w-full min-w-0" value={filtros.pagamento} onChange={e => setFiltros({ ...filtros, pagamento: e.target.value })}>
            <option value="todos">Todos</option>
            <option value="PIX">Pix</option>
            <option value="DINHEIRO">Dinheiro</option>
            <option value="CARTAO">Cartão (crédito e débito)</option>
            <option value="CARTAO_CREDITO">Crédito</option>
            <option value="CARTAO_DEBITO">Débito</option>
          </select>
        </div>
        <div className="flex justify-end min-w-0">
          <button type="button" className="btn-secondary" style={{ minHeight: 48 }} onClick={limparFiltros} disabled={!temFiltros}>Limpar filtros</button>
        </div>
        {erroPeriodo && <p id="relatorio-periodo" role="alert" className="col-span-full text-sm text-[var(--texto-secundario)] min-w-0">{erroPeriodo}</p>}
      </form>

      {/* Estado de carregamento */}
      {atualizando && <SkeletonTable rows={5} cols={4} />}

      {/* Estado de erro */}
      {!erroPeriodo && !atualizando && erro && (
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
          <WarningCircle size={20} style={{ color: 'var(--error-text)', flexShrink: 0 }} />
          <div>
            <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Erro ao carregar relatório
            </p>
            <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--texto-secundario)', marginTop: '4px' }}>
              {erro}
            </p>
            <button className="btn-secondary min-h-12 mt-3" style={{ minHeight: 48 }} onClick={buscarRelatorio}>Tentar novamente</button>
          </div>
        </div>
      )}

      {/* Resultado do relatório */}
      {!erroPeriodo && !atualizando && !erro && relatorio && (
        <>
          {!!relatorio.produtosSemDetalhamento && filtros.natureza !== 'servicos' && <p role="status" className="text-sm text-[var(--texto-secundario)]">
            {relatorio.produtosSemDetalhamento} lançamento(s) de produtos sem detalhamento suficiente para separar por produto. Esses valores aparecem em Todos os produtos, mas não na seleção de um produto individual.
          </p>}
          {/* Cards de Totais */}
          <div className="dashboard-grid">
            {filtros.natureza !== 'produtos' && <StatCard
              titulo="Receita de serviços (bruto)"
              valor={fmt(relatorio.consolidado.totalBruto)}
              icone={Scissors}
              subtexto="Soma de serviços prestados"
            />}
            {filtros.natureza !== 'servicos' && <StatCard
              titulo="Receita de produtos"
              valor={fmt(relatorio.consolidado.totalProdutos)}
              icone={CurrencyDollar}
              subtexto="Vendas de produtos menos estornos"
            />}
            <StatCard
              titulo="Comissões pagas"
              valor={fmt(relatorio.consolidado.totalComissoes)}
              icone={Users}
              subtexto="Total aos barbeiros"
            />
            <StatCard
              titulo="Lucro líquido"
              valor={fmt(relatorio.consolidado.totalLiquido)}
              icone={TrendingUp}
              subtexto={filtros.natureza === 'produtos' ? 'Produtos menos estornos' : filtros.natureza === 'servicos' ? 'Serviços menos comissões' : 'Serviços + produtos − estornos − comissões'}
            />
          </div>

          {/* Resumo por Barbeiro (quando "Todos" está selecionado) */}
          {filtros.natureza !== 'produtos' && filtros.barbeiroId === 'todos' && Object.keys(relatorio.consolidado.porBarbeiro).length > 0 && (
            <div className="card">
              <h3 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
                Resumo por barbeiro
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '16px' }}>
                {Object.values(relatorio.consolidado.porBarbeiro).map((b, i) => (
                  <div key={i} style={{ padding: '16px', background: 'var(--bg-surface2)', border: '1px solid var(--border)' }}>
                    <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>{b.nome}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <p style={{ fontSize: 13, color: 'var(--texto-secundario)' }}>Percentual aplicado: {b.percentualAplicado != null ? `${b.percentualAplicado}%` : 'Variável ou não registrado'}</p>
                      {!!b.lancamentosDivergentes && <p style={{ fontSize: 13, color: 'var(--error-text)' }}>{b.lancamentosDivergentes} lançamento(s) com comissão divergente.</p>}
                      {!!b.lancamentosSemBaseAuditavel && <p style={{ fontSize: 13, color: 'var(--texto-secundario)' }}>{b.lancamentosSemBaseAuditavel} lançamento(s) sem percentual ou base histórica suficiente para conferência.</p>}
                      <div className="flex justify-between items-center" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px' }}><span style={{ color: 'var(--texto-secundario)' }}>Produzido:</span><span style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '16px', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{fmt(b.bruto)}</span></div>
                      <div className="flex justify-between items-center" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px' }}><span style={{ color: 'var(--texto-secundario)' }}>Comissão:</span><span style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '16px', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{fmt(b.comissao)}</span></div>
                      <div className="flex justify-between items-center" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}><span style={{ color: 'var(--texto-secundario)' }}>Líquido:</span><span style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '16px', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', fontWeight: 600 }}>{fmt(b.liquido)}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabela de Lançamentos */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <h3 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
              Detalhamento dos lançamentos
              <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '0.8125rem', color: 'var(--texto-secundario)', marginLeft: '12px', fontWeight: 400 }}>
                {entradas.length} {entradas.length === 1 ? 'registro' : 'registros'}
              </span>
            </h3>
            <div className="table-wrapper overflow-x-auto">
              <table className="ds-table">
                <thead>
                  <tr>
                    <th style={{ fontSize: '13px' }}>Data</th>
                    <th style={{ fontSize: '13px' }}>Barbeiro / lançamento</th>
                    <th style={{ fontSize: '13px' }}>Forma de pagamento</th>
                    <th style={{ fontSize: '13px', textAlign: 'center' }}>Valor total</th>
                    <th style={{ fontSize: '13px', textAlign: 'center' }}>Comissão</th>
                    <th style={{ fontSize: '13px', textAlign: 'center' }}>Líquido</th>
                    <th style={{ width: '100px', fontSize: '13px', textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {entradas.map((l) => (
                    <tr key={l.id}>
                      <td style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '16px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: 'var(--texto-secundario)' }}>
                        {new Date(l.data).toLocaleDateString('pt-BR')}
                      </td>
                        <td>
                          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)' }}>
                            {(l.categoria === 'Venda de Produto' || l.categoria === 'Estorno de Produto')
                              ? `${l.categoria}${l.descricao ? ': ' + l.descricao : ''}`
                              : l.itens && l.itens.length > 0
                              ? l.itens.map((i: any) => i.nome).join(' + ')
                              : (l.servico ? l.servico.nome : l.categoria)}
                          </p>
                        <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '0.8125rem', color: 'var(--texto-secundario)', marginTop: '2px' }}>
                          {l.barbeiro ? l.barbeiro.usuario.nome : 'Sem Barbeiro'}
                        </p>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{ fontSize: '13px', background: 'var(--fundo-superficie-2)', color: 'var(--texto-secundario)' }}
                        >
                          {FORMA_PAGAMENTO_LABELS[l.formaPagamento] || l.formaPagamento}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--fonte-numeros)', fontSize: '16px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{fmt(l.tipo === 'SAIDA' ? -Number(l.valor) : l.valor)}</td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--fonte-numeros)', fontSize: '16px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{l.valorComissao ? fmt(l.valorComissao) : '—'}</td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--fonte-numeros)', fontSize: '16px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{fmt(l.tipo === 'SAIDA' ? -Number(l.valor) : Number(l.valor) - Number(l.valorComissao ?? 0))}</td>
                      <td style={{ width: '100px', textAlign: 'center', verticalAlign: 'middle' }}>
                        {l.categoria === 'Venda de Produto' || l.categoria === 'Estorno de Produto' ? <span className="text-sm text-[var(--texto-secundario)]">Gerenciado no estoque</span> : <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                          <button
                            onClick={() => handleEditar(l)}
                            style={{ width: '40px', height: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--texto-secundario)' }}
                            aria-label="Editar lançamento"
                            title="Editar lançamento"
                          >
                            <PencilSimple size={18} />
                          </button>
                          <button
                            onClick={() => setConfirmandoExclusao(l.id)}
                            style={{ width: '40px', height: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--error-text)' }}
                            aria-label="Excluir lançamento"
                            title="Excluir lançamento"
                          >
                            <Trash size={18} />
                          </button>
                        </div>}
                      </td>
                    </tr>
                  ))}
                  {entradas.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--texto-secundario)', fontFamily: 'var(--fonte-interface)', fontSize: '13px' }}>
                        {filtros.natureza === 'produtos' ? 'Não há vendas ou estornos de produtos para os filtros selecionados.' : filtros.natureza === 'servicos' ? 'Não há serviços para os filtros selecionados.' : 'Não há lançamentos para os filtros selecionados.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal de Edição */}
      {lancamentoEditando && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Editar Lançamento</h3>
              <button onClick={() => setLancamentoEditando(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--texto-secundario)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                <label className="input-label">Serviço Realizado</label>
                <select
                  className="ds-select"
                  value={valoresEdit.servicoId}
                  onChange={e => setValoresEdit({...valoresEdit, servicoId: e.target.value})}
                >
                  <option value="">Selecione (ou deixe em branco)</option>
                  {servicos.map(s => <option key={s.id} value={s.id}>{s.nome} - {fmt(s.preco)}</option>)}
                </select>
              </div>

              <div>
                <label className="input-label">Valor Total (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="ds-input"
                  value={valoresEdit.valor}
                  onChange={e => setValoresEdit({...valoresEdit, valor: e.target.value})}
                />
              </div>

              <div>
                <label className="input-label">Comissão atual (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="ds-input"
                  value={valoresEdit.comissao}
                  readOnly
                  aria-describedby="comissao-automatica"
                />
                <p id="comissao-automatica" style={{ fontSize: 13, color: 'var(--texto-secundario)', marginTop: 8 }}>Calculada pelo servidor ao salvar. O percentual preservado é mantido; lançamentos antigos sem percentual usam a configuração atual do barbeiro.</p>
              </div>

              <div>
                <label className="input-label">Forma de Pagamento</label>
                <select
                  className="ds-select"
                  value={valoresEdit.formaPagamento}
                  onChange={e => setValoresEdit({...valoresEdit, formaPagamento: e.target.value})}
                >
                  <option value="DINHEIRO">Dinheiro</option>
                  <option value="PIX">Pix</option>
                  <option value="CARTAO_DEBITO">Cartão de Débito</option>
                  <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                </select>
              </div>

              {servicosAdicionais.map((srv, index) => (
                <div key={index} style={{ borderTop: '1px dashed var(--border)', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="input-label">Serviço Adicional {index + 1}</label>
                    <button onClick={() => {
                      const novos = [...servicosAdicionais];
                      novos.splice(index, 1);
                      setServicosAdicionais(novos);
                    }} style={{ background: 'transparent', border: 'none', color: 'var(--error-text)', fontSize: '0.8125rem', cursor: 'pointer' }}>Remover</button>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      className="ds-select"
                      value={srv.servicoId}
                      onChange={e => {
                        const s = servicos.find(sv => sv.id === e.target.value);
                        const novos = [...servicosAdicionais];
                        novos[index].servicoId = e.target.value;
                        if (s) novos[index].valor = String(s.preco);
                        setServicosAdicionais(novos);
                      }}
                      style={{ flex: 2 }}
                    >
                      <option value="">Selecione...</option>
                      {servicos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </select>
                    <input
                      type="number"
                      placeholder="Valor"
                      className="ds-input"
                      value={srv.valor}
                      onChange={e => {
                        const novos = [...servicosAdicionais];
                        novos[index].valor = e.target.value;
                        setServicosAdicionais(novos);
                      }}
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>
              ))}

              <button
                className="btn-secondary"
                style={{ fontSize: '0.8125rem', padding: '8px', borderStyle: 'dashed' }}
                onClick={() => setServicosAdicionais([...servicosAdicionais, { servicoId: '', valor: '' }])}
              >
                <Plus size={14} /> Adicionar Serviço Extra
              </button>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setLancamentoEditando(null)}
                >
                  Cancelar
                </button>
                <button
                  className="btn-primary"
                  style={{ flex: 1 }}
                  onClick={salvarEdicao}
                  disabled={salvandoEdicao}
                >
                  {salvandoEdicao ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
              onClick={() => confirmandoExclusao && excluirLancamento(confirmandoExclusao)}
            >
              Excluir
            </Botao>
          </div>
        </div>
      </Modal>
    </div>
  );
}
