// Página de Serviços — tabela com edição inline
import { useEffect, useState } from 'react';
import { Plus, Check, X, Pencil } from 'lucide-react';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import api from '../api/client';

interface Servico {
  id: string; nome: string; descricao: string | null;
  preco: string; duracaoMinutos: number; comissaoPercent: number; ativo: boolean;
}

export function Servicos() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ preco: '', duracaoMinutos: '' });
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState({ nome: '', descricao: '', preco: '', duracaoMinutos: '', comissaoPercent: '50' });

  async function carregar() {
    try { const r = await api.get<Servico[]>('/servicos'); setServicos(r.data); }
    catch (e) { console.error(e); } finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  function iniciarEdicao(s: Servico) {
    setEditandoId(s.id);
    setEditForm({ preco: String(Number(s.preco)), duracaoMinutos: String(s.duracaoMinutos) });
  }

  async function salvarEdicao(id: string) {
    try {
      await api.put(`/servicos/${id}`, { preco: Number(editForm.preco), duracaoMinutos: Number(editForm.duracaoMinutos) });
      setEditandoId(null); carregar();
    } catch (e) { console.error(e); }
  }

  async function criarServico() {
    try {
      await api.post('/servicos', { nome: form.nome, descricao: form.descricao || undefined, preco: Number(form.preco), duracaoMinutos: Number(form.duracaoMinutos), comissaoPercent: Number(form.comissaoPercent) });
      setModalAberto(false); setForm({ nome: '', descricao: '', preco: '', duracaoMinutos: '', comissaoPercent: '50' }); carregar();
    } catch (e) { console.error(e); }
  }

  if (carregando) return <LoadingSpinner />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Serviços</h1>
        <button onClick={() => setModalAberto(true)} className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-neutral-900 text-sm font-semibold rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Novo
        </button>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-neutral-800">
            <th className="text-left p-4 text-neutral-500 font-medium">Serviço</th>
            <th className="text-left p-4 text-neutral-500 font-medium">Preço</th>
            <th className="text-left p-4 text-neutral-500 font-medium">Duração</th>
            <th className="text-left p-4 text-neutral-500 font-medium">Comissão</th>
            <th className="text-right p-4 text-neutral-500 font-medium">Ações</th>
          </tr></thead>
          <tbody>
            {servicos.map(s => (
              <tr key={s.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                <td className="p-4"><p className="text-white font-medium">{s.nome}</p>{s.descricao && <p className="text-neutral-500 text-xs mt-0.5">{s.descricao}</p>}</td>
                <td className="p-4">
                  {editandoId === s.id ? (
                    <input type="number" step="0.01" value={editForm.preco} onChange={e => setEditForm({...editForm, preco: e.target.value})} className="w-24 px-2 py-1 bg-neutral-800 border border-cyan-500 rounded text-white text-sm focus:outline-none" />
                  ) : <span className="text-white">R$ {Number(s.preco).toFixed(2)}</span>}
                </td>
                <td className="p-4">
                  {editandoId === s.id ? (
                    <input type="number" value={editForm.duracaoMinutos} onChange={e => setEditForm({...editForm, duracaoMinutos: e.target.value})} className="w-20 px-2 py-1 bg-neutral-800 border border-cyan-500 rounded text-white text-sm focus:outline-none" />
                  ) : <span className="text-neutral-300">{s.duracaoMinutos} min</span>}
                </td>
                <td className="p-4 text-neutral-300">{s.comissaoPercent}%</td>
                <td className="p-4 text-right">
                  {editandoId === s.id ? (
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => salvarEdicao(s.id)} className="p-1.5 text-green-400 hover:bg-green-500/10 rounded transition-colors"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditandoId(null)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <button onClick={() => iniciarEdicao(s)} className="p-1.5 text-neutral-500 hover:text-cyan-400 hover:bg-neutral-800 rounded transition-colors"><Pencil className="w-4 h-4" /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Novo Serviço">
        <div className="space-y-4">
          <div><label className="block text-xs font-medium text-neutral-400 mb-1">Nome</label>
          <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500" /></div>
          <div><label className="block text-xs font-medium text-neutral-400 mb-1">Descrição</label>
          <input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-neutral-400 mb-1">Preço (R$)</label>
            <input type="number" step="0.01" value={form.preco} onChange={e => setForm({...form, preco: e.target.value})} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500" /></div>
            <div><label className="block text-xs font-medium text-neutral-400 mb-1">Duração (min)</label>
            <input type="number" value={form.duracaoMinutos} onChange={e => setForm({...form, duracaoMinutos: e.target.value})} className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500" /></div>
          </div>
          <button onClick={criarServico} className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-neutral-900 font-semibold text-sm rounded-lg transition-colors">Cadastrar</button>
        </div>
      </Modal>
    </div>
  );
}
