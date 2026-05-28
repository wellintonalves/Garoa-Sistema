// Página de Estoque — estética industrial
import { useEffect, useState } from 'react';
import { Plus, Pencil, Check, X } from 'lucide-react';
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
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="flex items-center justify-between">
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '32px',
            color: 'var(--text-primary)',
            letterSpacing: '0.04em',
          }}
        >
          Estoque
        </h1>
        <button onClick={() => setModalAberto(true)} className="btn-primary">
          <Plus size={14} strokeWidth={1.5} /> Novo Item
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="ds-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Quantidade</th>
              <th>Mínimo</th>
              <th>Custo Unit.</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.map(item => {
              const baixo = item.quantidade <= item.quantidadeMinima;
              return (
                <tr key={item.id} style={{ background: baixo ? 'rgba(226, 75, 74, 0.05)' : 'transparent' }}>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.nome}</td>
                  <td>
                    {editandoId === item.id ? (
                      <input type="number" value={editQtd} onChange={e => setEditQtd(e.target.value)} className="ds-input" style={{ width: '80px', minHeight: '32px', padding: '6px 8px' }} />
                    ) : (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: baixo ? 'var(--error-text)' : 'var(--text-primary)' }}>
                        {item.quantidade} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{item.unidade}</span>
                      </span>
                    )}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>{item.quantidadeMinima}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>R$ {Number(item.custo).toFixed(2)}</td>
                  <td>
                    {baixo ? (
                      <span className="badge badge-cancelled">Baixo</span>
                    ) : (
                      <span className="badge badge-confirmed">OK</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {editandoId === item.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => salvarQtd(item.id)}
                          className="flex items-center justify-center transition-colors"
                          style={{ width: '28px', height: '28px', color: 'var(--success-text)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                        >
                          <Check size={14} strokeWidth={1.5} />
                        </button>
                        <button
                          onClick={() => setEditandoId(null)}
                          className="flex items-center justify-center transition-colors"
                          style={{ width: '28px', height: '28px', color: 'var(--error-text)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                        >
                          <X size={14} strokeWidth={1.5} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditandoId(item.id); setEditQtd(String(item.quantidade)); }}
                        className="flex items-center justify-center transition-colors"
                        style={{ width: '28px', height: '28px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--amber)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                      >
                        <Pencil size={14} strokeWidth={1.5} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Novo Item">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div><label className="input-label">Nome</label>
          <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="ds-input" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div><label className="input-label">Quantidade</label>
            <input type="number" value={form.quantidade} onChange={e => setForm({...form, quantidade: e.target.value})} className="ds-input" /></div>
            <div><label className="input-label">Unidade</label>
            <input value={form.unidade} onChange={e => setForm({...form, unidade: e.target.value})} className="ds-input" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div><label className="input-label">Qtd. Mínima</label>
            <input type="number" value={form.quantidadeMinima} onChange={e => setForm({...form, quantidadeMinima: e.target.value})} className="ds-input" /></div>
            <div><label className="input-label">Custo (R$)</label>
            <input type="number" step="0.01" value={form.custo} onChange={e => setForm({...form, custo: e.target.value})} className="ds-input" /></div>
          </div>
          <button onClick={criarItem} className="btn-primary w-full justify-center">Cadastrar</button>
        </div>
      </Modal>
    </div>
  );
}
