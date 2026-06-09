// Página de Serviços — tabela industrial com edição inline
import { useEffect, useState } from 'react';
import { Plus, Check, X, Pencil } from 'lucide-react';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import api from '../api/client';

interface Servico {
  id: string; nome: string; descricao: string | null;
  preco: string; duracaoMinutos: number; comissaoPercent: number; cor: string; ativo: boolean;
}

export function Servicos() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ preco: '', duracaoMinutos: '' });
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState({ nome: '', descricao: '', preco: '', duracaoMinutos: '', comissaoPercent: '50', cor: '#22C55E' });

  const coresSugeridas = [
    { cor: '#22C55E', nome: 'Verde (Cortes)' },
    { cor: '#3B82F6', nome: 'Azul (Barba)' },
    { cor: '#A855F7', nome: 'Roxo (Tratamentos)' },
    { cor: '#EAB308', nome: 'Amarelo (Combos)' },
  ];

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
      await api.post('/servicos', { nome: form.nome, descricao: form.descricao || undefined, preco: Number(form.preco), duracaoMinutos: Number(form.duracaoMinutos), comissaoPercent: Number(form.comissaoPercent), cor: form.cor });
      setModalAberto(false); setForm({ nome: '', descricao: '', preco: '', duracaoMinutos: '', comissaoPercent: '50', cor: '#22C55E' }); carregar();
    } catch (e) { console.error(e); }
  }

  if (carregando) return <LoadingSpinner />;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '32px',
            color: 'var(--text-primary)',
            letterSpacing: '0.04em',
          }}
        >
          Serviços
        </h1>
        <button onClick={() => setModalAberto(true)} className="btn-primary">
          <Plus size={14} strokeWidth={1.5} /> Novo
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table className="ds-table">
          <thead><tr>
            <th>Serviço</th>
            <th>Preço</th>
            <th>Duração</th>
            <th>Comissão</th>
            <th style={{ textAlign: 'right' }}>Ações</th>
          </tr></thead>
          <tbody>
            {servicos.map(s => (
              <tr key={s.id}>
                <td>
                  <p style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{s.nome}</p>
                  {s.descricao && <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', letterSpacing: '0.04em' }}>{s.descricao}</p>}
                </td>
                <td>
                  {editandoId === s.id ? (
                    <input type="number" step="0.01" value={editForm.preco} onChange={e => setEditForm({...editForm, preco: e.target.value})} className="ds-input" style={{ width: '100px', minHeight: '32px', padding: '6px 8px' }} />
                  ) : (
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--cor-icone)' }}>
                      R$ {Number(s.preco).toFixed(2)}
                    </span>
                  )}
                </td>
                <td>
                  {editandoId === s.id ? (
                    <input type="number" value={editForm.duracaoMinutos} onChange={e => setEditForm({...editForm, duracaoMinutos: e.target.value})} className="ds-input" style={{ width: '80px', minHeight: '32px', padding: '6px 8px' }} />
                  ) : (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                      {s.duracaoMinutos} min
                    </span>
                  )}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>{s.comissaoPercent}%</td>
                <td style={{ textAlign: 'right' }}>
                  {editandoId === s.id ? (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => salvarEdicao(s.id)}
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
                      onClick={() => iniciarEdicao(s)}
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
            ))}
          </tbody>
          </table>
        </div>
      </div>

      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Novo Serviço">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div><label className="input-label">Nome</label>
          <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="ds-input" /></div>
          <div><label className="input-label">Descrição</label>
          <input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} className="ds-input" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div><label className="input-label">Preço (R$)</label>
            <input type="number" step="0.01" value={form.preco} onChange={e => setForm({...form, preco: e.target.value})} className="ds-input" /></div>
            <div><label className="input-label">Duração (min)</label>
            <input type="number" value={form.duracaoMinutos} onChange={e => setForm({...form, duracaoMinutos: e.target.value})} className="ds-input" /></div>
          </div>
          <div>
            <label className="input-label">Cor do Serviço</label>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input type="color" value={form.cor} onChange={e => setForm({...form, cor: e.target.value})} style={{ width: '38px', height: '38px', padding: '0', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }} />
                <input type="text" value={form.cor} onChange={e => setForm({...form, cor: e.target.value})} className="ds-input flex-1" style={{ textTransform: 'uppercase' }} />
              </div>
              <div className="flex flex-wrap gap-2 mt-1">
                {coresSugeridas.map(c => (
                  <button key={c.cor} onClick={() => setForm({...form, cor: c.cor})} title={c.nome} style={{ width: '24px', height: '24px', borderRadius: '50%', background: c.cor, border: form.cor === c.cor ? '2px solid white' : '2px solid transparent', cursor: 'pointer', outline: form.cor === c.cor ? `2px solid ${c.cor}` : 'none' }} />
                ))}
              </div>
            </div>
          </div>
          <button onClick={criarServico} className="btn-primary w-full justify-center">Cadastrar</button>
        </div>
      </Modal>
    </div>
  );
}
