// Página de Estoque — tabela com indicador de baixo estoque
import { useEffect, useState } from 'react';
import { Plus, AlertTriangle, Pencil, Check, X } from 'lucide-react';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import api from '../api/client';

interface ItemEstoque {
  id: string; nome: string; quantidade: number; unidade: string;
  quantidadeMinima: number; custo: string;
}

export function Estoque() {
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editQtd, setEditQtd] = useState('');
  const [form, setForm] = useState({ nome: '', quantidade: '', unidade: 'unidade', quantidadeMinima: '5', custo: '' });

  async function carregar() {
    try { const r = await api.get<ItemEstoque[]>('/estoque'); setItens(r.data); }
    catch (e) { console.error(e); } finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  async function criarItem() {
    try {
      await api.post('/estoque', { nome: form.nome, quantidade: Number(form.quantidade), unidade: form.unidade, quantidadeMinima: Number(form.quantidadeMinima), custo: Number(form.custo) });
      setModalAberto(false); setForm({ nome: '', quantidade: '', unidade: 'unidade', quantidadeMinima: '5', custo: '' }); carregar();
    } catch (e) { console.error(e); }
  }

  async function salvarQtd(id: string) {
    try {
      await api.put(`/estoque/${id}`, { quantidade: Number(editQtd) });
      setEditandoId(null); carregar();
    } catch (e) { console.error(e); }
  }

  if (carregando) return <LoadingSpinner />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Estoque</h1>
        <button onClick={() => setModalAberto(true)} className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-neutral-900 text-sm font-semibold rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Novo Item
        </button>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-neutral-800">
            <th className="text-left p-4 text-neutral-500 font-medium">Produto</th>
            <th className="text-left p-4 text-neutral-500 font-medium">Quantidade</th>
            <th className="text-left p-4 text-neutral-500 font-medium">Mínimo</th>
            <th className="text-left p-4 text-neutral-500 font-medium">Custo Unit.</th>
            <th className="text-left p-4 text-neutral-500 font-medium">Status</th>
            <th className="text-right p-4 text-neutral-500 font-medium">Ações</th>
          </tr></thead>
          <tbody>
            {itens.map(item => {
              const baixo = item.quantidade <= item.quantidadeMinima;
              return (
                <tr key={item.id} className={`border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors ${baixo ? 'bg-red-500/5' : ''}`}>
                  <td className="p-4 text-white font-medium">{item.nome}</td>
                  <td className="p-4">
                    {editandoId === item.id ? (
                      <input type="number" value={editQtd} onChange={e => setEditQtd(e.target.value)} className="w-20 px-2 py-1 bg-neutral-800 border border-cyan-500 rounded text-white text-sm focus:outline-none" />
                    ) : (
                      <span className="text-neutral-300">{item.quantidade} {item.unidade}</span>
                    )}
                  </td>
                  <td className="p-4 text-neutral-500">{item.quantidadeMinima}</td>
                  <td className="p-4 text-neutral-300">R$ {Number(item.custo).toFixed(2)}</td>
                  <td className="p-4">
                    {baixo ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/10 text-red-400 text-xs rounded-full">
                        <AlertTriangle className="w-3 h-3" /> Baixo
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full">OK</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    {editandoId === item.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => salvarQtd(item.id)} className="p-1.5 text-green-400 hover:bg-green-500/10 rounded"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditandoId(null)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditandoId(item.id); setEditQtd(String(item.quantidade)); }} className="p-1.5 text-neutral-500 hover:text-cyan-400 hover:bg-neutral-800 rounded"><Pencil className="w-4 h-4" /></button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Novo Item">
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-neutral-400 mb-1">Nome</label>
          <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-neutral-400 mb-1">Quantidade</label>
            <input type="number" value={form.quantidade} onChange={e => setForm({...form, quantidade: e.target.value})} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500" /></div>
            <div><label className="block text-xs font-medium text-neutral-400 mb-1">Unidade</label>
            <input value={form.unidade} onChange={e => setForm({...form, unidade: e.target.value})} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-neutral-400 mb-1">Qtd. Mínima</label>
            <input type="number" value={form.quantidadeMinima} onChange={e => setForm({...form, quantidadeMinima: e.target.value})} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500" /></div>
            <div><label className="block text-xs font-medium text-neutral-400 mb-1">Custo (R$)</label>
            <input type="number" step="0.01" value={form.custo} onChange={e => setForm({...form, custo: e.target.value})} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500" /></div>
          </div>
          <button onClick={criarItem} className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-neutral-900 font-semibold text-sm rounded-lg transition-colors">Cadastrar</button>
        </div>
      </Modal>
    </div>
  );
}
