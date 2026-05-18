// Página Financeiro — lançamentos, resumo do dia, gráfico 7 dias
import { useEffect, useState } from 'react';
import { Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import api from '../api/client';

interface Lancamento {
  id: string; tipo: string; categoria: string; descricao: string | null;
  valor: string; formaPagamento: string; data: string;
}
interface ResumoDia {
  totalEntradas: number; totalSaidas: number; saldo: number;
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
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState({ tipo: 'ENTRADA', categoria: '', descricao: '', valor: '', formaPagamento: 'PIX', data: new Date().toISOString().split('T')[0] });

  async function carregar() {
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const [l, r, g] = await Promise.all([
        api.get<Lancamento[]>('/financeiro', { params: { inicio: hoje, fim: hoje } }),
        api.get<ResumoDia>('/financeiro/resumo-dia', { params: { data: hoje } }),
        api.get<DadoGrafico[]>('/financeiro/ultimos-7-dias'),
      ]);
      setLancamentos(l.data); setResumo(r.data); setGrafico(g.data);
    } catch (e) { console.error(e); }
    finally { setCarregando(false); }
  }

  useEffect(() => { carregar(); }, []);

  async function criarLancamento() {
    try {
      await api.post('/financeiro', { ...form, valor: Number(form.valor) });
      setModalAberto(false); setForm({ tipo: 'ENTRADA', categoria: '', descricao: '', valor: '', formaPagamento: 'PIX', data: new Date().toISOString().split('T')[0] });
      carregar();
    } catch (e) { console.error(e); }
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const maxGrafico = Math.max(...grafico.map(d => Math.max(d.entradas, d.saidas)), 1);

  if (carregando) return <LoadingSpinner />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Financeiro</h1>
        <button onClick={() => setModalAberto(true)} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-900 text-sm font-semibold rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Lançamento
        </button>
      </div>

      {/* Resumo do dia */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-neutral-900 border border-green-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-400 mb-1"><TrendingUp className="w-4 h-4" /><span className="text-xs font-medium">Entradas</span></div>
          <p className="text-xl font-bold text-white">{fmt(resumo?.totalEntradas || 0)}</p>
        </div>
        <div className="bg-neutral-900 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-400 mb-1"><TrendingDown className="w-4 h-4" /><span className="text-xs font-medium">Saídas</span></div>
          <p className="text-xl font-bold text-white">{fmt(resumo?.totalSaidas || 0)}</p>
        </div>
        <div className="bg-neutral-900 border border-amber-500/20 rounded-xl p-4">
          <p className="text-xs font-medium text-amber-400 mb-1">Saldo</p>
          <p className="text-xl font-bold text-white">{fmt(resumo?.saldo || 0)}</p>
          {resumo?.porFormaPagamento && (
            <div className="mt-2 space-y-1">
              {Object.entries(resumo.porFormaPagamento).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs"><span className="text-neutral-500">{labelsForma[k] || k}</span><span className="text-neutral-300">{fmt(v)}</span></div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mini gráfico 7 dias */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-neutral-400 mb-4">Últimos 7 dias</h3>
        <div className="flex items-end gap-2 h-32">
          {grafico.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex gap-0.5 items-end justify-center h-24">
                <div className="w-3 bg-green-500/60 rounded-t transition-all" style={{ height: `${(d.entradas / maxGrafico) * 100}%` }} title={`Entradas: ${fmt(d.entradas)}`} />
                <div className="w-3 bg-red-500/60 rounded-t transition-all" style={{ height: `${(d.saidas / maxGrafico) * 100}%` }} title={`Saídas: ${fmt(d.saidas)}`} />
              </div>
              <span className="text-[10px] text-neutral-600">{new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-green-500/60 rounded" /><span className="text-neutral-500">Entradas</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-red-500/60 rounded" /><span className="text-neutral-500">Saídas</span></div>
        </div>
      </div>

      {/* Lançamentos do dia */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <h3 className="text-sm font-medium text-neutral-400 p-4 border-b border-neutral-800">Lançamentos de Hoje</h3>
        <div className="divide-y divide-neutral-800/50">
          {lancamentos.map(l => (
            <div key={l.id} className="flex items-center justify-between p-4 hover:bg-neutral-800/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${l.tipo === 'ENTRADA' ? 'bg-green-400' : 'bg-red-400'}`} />
                <div><p className="text-sm text-white">{l.categoria}</p>{l.descricao && <p className="text-xs text-neutral-500">{l.descricao}</p>}</div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-medium ${l.tipo === 'ENTRADA' ? 'text-green-400' : 'text-red-400'}`}>{l.tipo === 'ENTRADA' ? '+' : '-'} {fmt(Number(l.valor))}</p>
                <p className="text-xs text-neutral-600">{labelsForma[l.formaPagamento] || l.formaPagamento}</p>
              </div>
            </div>
          ))}
          {lancamentos.length === 0 && <p className="p-8 text-center text-neutral-600 text-sm">Nenhum lançamento hoje</p>}
        </div>
      </div>

      {/* Modal */}
      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Novo Lançamento">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(['ENTRADA', 'SAIDA'] as const).map(t => (
              <button key={t} onClick={() => setForm({...form, tipo: t})} className={`py-2 rounded-lg text-sm font-medium transition-colors ${form.tipo === t ? (t === 'ENTRADA' ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/40') : 'bg-neutral-800 text-neutral-500 border border-neutral-700'}`}>
                {t === 'ENTRADA' ? 'Entrada' : 'Saída'}
              </button>
            ))}
          </div>
          <div><label className="block text-xs font-medium text-neutral-400 mb-1">Categoria</label>
          <input value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} placeholder="Ex: Serviço, Produto, Despesa" className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500" /></div>
          <div><label className="block text-xs font-medium text-neutral-400 mb-1">Valor (R$)</label>
          <input type="number" step="0.01" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500" /></div>
          <div><label className="block text-xs font-medium text-neutral-400 mb-1">Forma de Pagamento</label>
          <select value={form.formaPagamento} onChange={e => setForm({...form, formaPagamento: e.target.value})} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500">
            {formasPagamento.map(f => <option key={f} value={f}>{labelsForma[f]}</option>)}
          </select></div>
          <div><label className="block text-xs font-medium text-neutral-400 mb-1">Data</label>
          <input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500" /></div>
          <button onClick={criarLancamento} className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-900 font-semibold text-sm rounded-lg transition-colors">Registrar</button>
        </div>
      </Modal>
    </div>
  );
}
