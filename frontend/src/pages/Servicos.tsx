// Página de Serviços — tabela industrial com edição inline
import { useEffect, useState } from 'react';
import { Plus, Check, X, PencilSimple, Trash } from '@phosphor-icons/react';
import { Modal } from '../components/Modal';
import { ModalAlert } from '../components/ModalAlert';
import { SkeletonPage } from '../components/Skeleton';
import api from '../api/client';
import { CORES_CATEGORIA_SERVICO } from '../styles/tokens';

interface Servico {
  id: string; nome: string; descricao: string | null;
  preco: string; duracaoMinutos: number; cor: string; ativo: boolean;
}

const formatarMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function Servicos() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nome: '', preco: '', duracaoMinutos: '' });
  const [modalAberto, setModalAberto] = useState(false);
  const [servicoParaExcluir, setServicoParaExcluir] = useState<Servico | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: '', descricao: '', preco: '', duracaoMinutos: '', cor: 'var(--sucesso)' });

  const coresSugeridas = [
    { cor: 'var(--sucesso)', nome: 'Verde (Cortes)' },
    { cor: 'var(--info)', nome: 'Azul (Barba)' },
    { cor: CORES_CATEGORIA_SERVICO.roxo, nome: 'Roxo (Tratamentos)' },
    { cor: CORES_CATEGORIA_SERVICO.amarelo, nome: 'Amarelo (Combos)' },
  ];

  async function carregar() {
    try { const r = await api.get<Servico[]>('/servicos'); setServicos(r.data); }
    catch (e) { console.error(e); } finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  function iniciarEdicao(s: Servico) {
    setEditandoId(s.id);
    setEditForm({ nome: s.nome, preco: String(Number(s.preco)), duracaoMinutos: String(s.duracaoMinutos) });
  }

  async function salvarEdicao(id: string) {
    try {
      await api.put(`/servicos/${id}`, { 
        nome: editForm.nome,
        preco: Number(editForm.preco), 
        duracaoMinutos: Number(editForm.duracaoMinutos)
      });
      setEditandoId(null); carregar();
    } catch (e) { console.error(e); }
  }

  async function criarServico() {
    try {
      await api.post('/servicos', { nome: form.nome, descricao: form.descricao || undefined, preco: Number(form.preco), duracaoMinutos: Number(form.duracaoMinutos), cor: form.cor });
      setModalAberto(false); setForm({ nome: '', descricao: '', preco: '', duracaoMinutos: '', cor: 'var(--sucesso)' }); carregar();
    } catch (e) { console.error(e); }
  }

  async function excluirServico() {
    if (!servicoParaExcluir || excluindo) return;

    try {
      setExcluindo(true);
      await api.delete(`/servicos/${servicoParaExcluir.id}`);
      setServicoParaExcluir(null);
      await carregar();
    } catch (e) {
      console.error(e);
      const erro = e as { response?: { data?: { erro?: string } } };
      setErroExclusao(erro.response?.data?.erro || 'Não foi possível excluir o serviço. Tente novamente.');
    } finally {
      setExcluindo(false);
    }
  }

  if (carregando) return <SkeletonPage />;

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
          Serviços
        </h1>
        <button onClick={() => setModalAberto(true)} className="btn-primary">
          <Plus size={18} /> Novo serviço
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper overflow-x-auto">
          <table className="ds-table">
          <thead><tr>
            <th style={{ fontSize: '13px' }}>Serviço</th>
            <th style={{ fontSize: '13px', textAlign: 'center' }}>Preço</th>
            <th style={{ fontSize: '13px', textAlign: 'right' }}>Duração</th>
            <th style={{ width: '120px', fontSize: '13px', textAlign: 'center' }}>Ações</th>
          </tr></thead>
          <tbody>
            {servicos.map(s => (
              <tr key={s.id}>
                <td>
                  {editandoId === s.id ? (
                    <input type="text" value={editForm.nome} onChange={e => setEditForm({...editForm, nome: e.target.value})} className="ds-input" style={{ width: '100%', minWidth: '150px', minHeight: '32px', padding: '6px 8px' }} />
                  ) : (
                    <>
                      <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)' }}>{s.nome}</p>
                      {s.descricao && <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--texto-secundario)', marginTop: '2px' }}>{s.descricao}</p>}
                    </>
                  )}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {editandoId === s.id ? (
                    <input type="number" step="0.01" value={editForm.preco} onChange={e => setEditForm({...editForm, preco: e.target.value})} className="ds-input" style={{ width: '100px', minHeight: '32px', padding: '6px 8px' }} />
                  ) : (
                    <span style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '16px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: 'var(--cor-icone)' }}>
                      {formatarMoeda.format(Number(s.preco))}
                    </span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {editandoId === s.id ? (
                    <input type="number" value={editForm.duracaoMinutos} onChange={e => setEditForm({...editForm, duracaoMinutos: e.target.value})} className="ds-input" style={{ width: '80px', minHeight: '32px', padding: '6px 8px' }} />
                  ) : (
                    <span style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '16px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: 'var(--texto-secundario)' }}>
                      {s.duracaoMinutos} min
                    </span>
                  )}
                </td>
                <td style={{ width: '120px', textAlign: 'center' }}>
                  {editandoId === s.id ? (
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => salvarEdicao(s.id)}
                        className="flex items-center justify-center transition-colors"
                        style={{ width: '40px', height: '40px', color: 'var(--sucesso)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                        aria-label={`Salvar alterações de ${s.nome}`}
                        title="Salvar alterações"
                      >
                        <Check size={18} />
                      </button>
                      <button
                        onClick={() => setEditandoId(null)}
                        className="flex items-center justify-center transition-colors"
                        style={{ width: '40px', height: '40px', color: 'var(--error-text)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                        aria-label={`Cancelar edição de ${s.nome}`}
                        title="Cancelar edição"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => iniciarEdicao(s)}
                        className="flex items-center justify-center transition-colors"
                        style={{ width: '40px', height: '40px', color: 'var(--texto-secundario)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                        aria-label={`Editar ${s.nome}`}
                        title="Editar serviço"
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--amber)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--texto-secundario)'; }}
                      >
                        <PencilSimple size={18} />
                      </button>
                      <button
                        onClick={() => setServicoParaExcluir(s)}
                        className="flex items-center justify-center transition-colors"
                        style={{ width: '40px', height: '40px', color: 'var(--erro)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                        aria-label={`Excluir ${s.nome}`}
                        title="Excluir serviço"
                      >
                        <Trash size={18} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>

      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Novo serviço">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div><label className="input-label">Nome</label>
          <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="ds-input" /></div>
          <div><label className="input-label">Descrição</label>
          <input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} className="ds-input" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="input-label">Preço (R$)</label>
            <input type="number" step="0.01" value={form.preco} onChange={e => setForm({...form, preco: e.target.value})} className="ds-input" /></div>
            <div><label className="input-label">Duração (min)</label>
            <input type="number" value={form.duracaoMinutos} onChange={e => setForm({...form, duracaoMinutos: e.target.value})} className="ds-input" /></div>
          </div>
          <div>
            <label className="input-label">Cor do serviço</label>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input type="color" value={form.cor} onChange={e => setForm({...form, cor: e.target.value})} style={{ width: '38px', height: '38px', padding: '0', border: '1px solid var(--borda-forte)', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }} />
                <input type="text" value={form.cor} onChange={e => setForm({...form, cor: e.target.value})} className="ds-input flex-1" />
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

      <ModalAlert
        aberto={Boolean(servicoParaExcluir)}
        onFechar={() => !excluindo && setServicoParaExcluir(null)}
        onConfirmar={excluirServico}
        titulo="Excluir serviço?"
        mensagem={`Tem certeza de que deseja excluir ${servicoParaExcluir?.nome ?? 'este serviço'}? Ele será removido das opções futuras, mas o histórico existente será preservado.`}
        tipo="aviso"
        textoBotao={excluindo ? 'Excluindo...' : 'Excluir serviço'}
        textoCancelar="Cancelar"
        isConfirm
      />

      <ModalAlert
        aberto={Boolean(erroExclusao)}
        onFechar={() => setErroExclusao(null)}
        titulo="Não foi possível excluir"
        mensagem={erroExclusao ?? ''}
        tipo="erro"
      />
    </div>
  );
}
