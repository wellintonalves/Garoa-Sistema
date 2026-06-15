// Página de Barbeiros — listagem com cards + seção de comissões por período
import { useEffect, useState } from 'react';
import { Star, Plus, DollarSign, TrendingUp, Calendar, Edit2 } from 'lucide-react';
import { Modal } from '../components/Modal';
import { ImageCropperModal } from '../components/ImageCropperModal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

interface Barbeiro {
  id: string;
  foto: string | null;
  especialidades: string[];
  comissaoPercent: number;
  cor: string;
  ativo: boolean;
  usuario: { id: string; nome: string; email: string };
}

interface ComissaoBarbeiro {
  nome: string;
  bruto: number;
  comissao: number;
  liquido: number;
}

export function Barbeiros() {
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [cropModalAberto, setCropModalAberto] = useState(false);
  const [imagemParaCortar, setImagemParaCortar] = useState<string>('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: '', email: '', senha: '', foto: '', especialidades: '', comissaoPercent: '50', cor: '#F97316' });
  const navigate = useNavigate();

  // Seção de comissões
  const dataAtual = new Date();
  const dataPrimeiroDia = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), 1).toISOString().split('T')[0];
  const dataHoje = dataAtual.toISOString().split('T')[0];
  const [comissaoInicio, setComissaoInicio] = useState(dataPrimeiroDia);
  const [comissaoFim, setComissaoFim] = useState(dataHoje);
  const [comissoes, setComissoes] = useState<Record<string, ComissaoBarbeiro>>({});
  const [carregandoComissoes, setCarregandoComissoes] = useState(true);

  async function carregar() {
    try {
      const res = await api.get<Barbeiro[]>('/barbeiros');
      setBarbeiros(res.data);
    } catch (err) { console.error(err); }
    finally { setCarregando(false); }
  }

  async function carregarComissoes() {
    setCarregandoComissoes(true);
    try {
      const res = await api.get('/financeiro/relatorio', {
        params: { inicio: comissaoInicio, fim: comissaoFim, barbeiroId: 'todos' }
      });
      setComissoes(res.data.consolidado.porBarbeiro || {});
    } catch (err) { console.error(err); }
    finally { setCarregandoComissoes(false); }
  }

  useEffect(() => { carregar(); }, []);
  useEffect(() => { carregarComissoes(); }, []);

  function abrirModalNovo() {
    setEditandoId(null);
    setForm({ nome: '', email: '', senha: '', foto: '', especialidades: '', comissaoPercent: '50', cor: '#F97316' });
    setModalAberto(true);
  }

  function abrirModalEditar(b: Barbeiro) {
    setEditandoId(b.id);
    setForm({
      nome: b.usuario.nome,
      email: b.usuario.email,
      senha: '', // leave blank if not changing
      foto: b.foto || '',
      especialidades: b.especialidades.join(', '),
      comissaoPercent: String(b.comissaoPercent),
      cor: b.cor || '#F97316',
    });
    setModalAberto(true);
  }

  async function salvarBarbeiro() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {
        nome: form.nome,
        email: form.email,
        foto: form.foto,
        especialidades: form.especialidades.split(',').map(e => e.trim()).filter(Boolean),
        comissaoPercent: Number(form.comissaoPercent),
        cor: form.cor,
      };
      
      if (form.senha) {
        payload.senha = form.senha;
      }

      if (editandoId) {
        await api.put(`/barbeiros/${editandoId}`, payload);
      } else {
        if (!form.senha) {
          alert('Senha é obrigatória para novos barbeiros.');
          return;
        }
        await api.post('/barbeiros', payload);
      }
      
      setModalAberto(false);
      setEditandoId(null);
      setForm({ nome: '', email: '', senha: '', foto: '', especialidades: '', comissaoPercent: '50', cor: '#F97316' });
      carregar();
    } catch (err) { console.error(err); }
  }

  const fmt = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Pega iniciais do nome para avatar
  function getIniciais(nome: string) {
    return nome.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }

  if (carregando) return <LoadingSpinner />;

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
          Barbeiros
        </h1>
        <button onClick={abrirModalNovo} className="btn-primary">
          <Plus size={14} strokeWidth={1.5} /> Novo
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {barbeiros.map(b => (
          <div
            key={b.id}
            className="card"
            style={{ borderLeft: b.ativo ? '2px solid var(--amber)' : '2px solid var(--border)' }}
          >
            <div className="flex items-center gap-4 mb-4">
              {/* Avatar com iniciais ou foto */}
              {b.foto ? (
                <img src={b.foto} alt={b.usuario.nome} className="w-12 h-12 rounded-full object-cover border-2 border-[var(--border)]" />
              ) : (
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: '48px',
                    height: '48px',
                    background: 'rgba(var(--cor-primaria-rgb), 0.10)',
                    fontFamily: 'var(--fonte-interface)',
                    fontSize: '20px',
                    color: 'rgba(var(--cor-primaria-rgb), 0.15)',
                    letterSpacing: '0.04em',
                    borderRadius: '50%',
                  }}
                >
                  {getIniciais(b.usuario.nome)}
                </div>
              )}
              <div className="min-w-0">
                <h3
                  className="truncate"
                  style={{
                    fontFamily: 'var(--fonte-interface)',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  {b.usuario.nome}
                </h3>
                <p
                  className="truncate"
                  style={{
                    fontFamily: 'var(--fonte-interface)',
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.04em',
                  }}
                >
                  {b.usuario.email}
                </p>
              </div>
              {/* Indicadores */}
              <div className="ml-auto flex flex-col gap-1 items-end">
                <div
                  className="flex-shrink-0 badge"
                  style={b.ativo
                    ? { background: '#1A3D2A', color: 'var(--success-text)' }
                    : { background: 'var(--bg-surface2)', color: 'var(--text-disabled)' }
                  }
                >
                  {b.ativo ? 'Ativo' : 'Inativo'}
                </div>
                <button
                  onClick={() => abrirModalEditar(b)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--cor-icone)',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Editar Barbeiro"
                >
                  <Edit2 size={14} />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {b.especialidades.map((e, i) => (
                <span
                  key={i}
                  className="badge badge-info"
                >
                  {e}
                </span>
              ))}
            </div>
            <div
              className="flex items-center justify-between mt-4 pt-3"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-1.5" style={{ color: 'var(--cor-icone)', fontFamily: 'var(--fonte-interface)', fontSize: '11px', letterSpacing: '0.04em' }}>
                <Star size={14} strokeWidth={1.5} /> <span>Comissão: {b.comissaoPercent}%</span>
              </div>
              <button
                onClick={() => navigate(`/relatorios?barbeiroId=${b.id}`)}
                className="flex items-center gap-1 transition-colors"
                style={{
                  fontFamily: 'var(--fonte-interface)',
                  fontSize: '9px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--amber)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                title="Ver comissões"
              >
                <DollarSign size={12} strokeWidth={1.5} /> Comissões
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Seção de Comissões por Período */}
      <div className="card">
        <div style={{ paddingBottom: '1.25rem', borderBottom: '1px solid var(--border)', marginBottom: '1.25rem' }}>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} strokeWidth={1.5} style={{ color: 'var(--cor-icone)' }} />
              <h2
                style={{
                  fontFamily: 'var(--fonte-interface)',
                  fontSize: '16px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                Comissões por Barbeiro
              </h2>
            </div>
            <div className="flex flex-wrap items-end gap-3 ml-auto">
              <div>
                <label className="input-label">De</label>
                <input type="date" value={comissaoInicio} onChange={e => setComissaoInicio(e.target.value)} className="ds-input" />
              </div>
              <div>
                <label className="input-label">Até</label>
                <input type="date" value={comissaoFim} onChange={e => setComissaoFim(e.target.value)} className="ds-input" />
              </div>
              <button onClick={carregarComissoes} className="btn-primary">
                <Calendar size={14} strokeWidth={1.5} /> Buscar
              </button>
            </div>
          </div>
        </div>

        <div>
          {carregandoComissoes ? (
            <LoadingSpinner />
          ) : Object.keys(comissoes).length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
              {Object.entries(comissoes).map(([id, b]) => (
                <div key={id} className="card-featured">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="flex items-center justify-center"
                      style={{
                        width: '36px',
                        height: '36px',
                        background: 'rgba(var(--cor-primaria-rgb), 0.10)',
                        fontFamily: 'var(--fonte-interface)',
                        fontSize: '16px',
                        color: 'rgba(var(--cor-primaria-rgb), 0.15)',
                      }}
                    >
                      {getIniciais(b.nome)}
                    </div>
                    <p style={{ fontFamily: 'var(--fonte-interface)', fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px' }}>{b.nome}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                    <div className="flex justify-between items-center">
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--fonte-interface)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Produzido</span>
                      <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--fonte-numeros)', fontSize: '12px' }}>{fmt(b.bruto)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--fonte-interface)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Comissão</span>
                      <span style={{ color: 'var(--cor-icone)', fontFamily: 'var(--fonte-numeros)', fontSize: '12px', fontWeight: 500 }}>{fmt(b.comissao)}</span>
                    </div>
                    <div className="flex justify-between items-center" style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--fonte-interface)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Líquido</span>
                      <span style={{ color: 'var(--success-text)', fontFamily: 'var(--fonte-numeros)', fontSize: '12px', fontWeight: 500 }}>{fmt(b.liquido)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--fonte-interface)', fontSize: '11px', padding: '2rem 0' }}>
              Nenhuma comissão encontrada para o período selecionado.
            </p>
          )}
        </div>
      </div>

      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo={editandoId ? "Editar Barbeiro" : "Novo Barbeiro"}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="input-label">Foto do Barbeiro (Opcional, Max 2MB)</label>
            <div className="flex items-center gap-4">
              {form.foto ? (
                <img src={form.foto} alt="Foto do Barbeiro" className="w-12 h-12 object-cover rounded-full border border-[var(--border)]" />
              ) : (
                <div className="w-12 h-12 bg-[rgba(var(--cor-primaria-rgb), 0.10)] text-[rgba(var(--cor-primaria-rgb), 0.15)] rounded-full flex items-center justify-center font-bold">
                  {form.nome ? getIniciais(form.nome) : 'B'}
                </div>
              )}
              <input type="file" accept="image/png, image/jpeg, image/webp" onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  const file = e.target.files[0];
                  if (file.size > 2 * 1024 * 1024) { alert('Arquivo muito grande (Max 2MB)'); return; }
                  const reader = new FileReader();
                  reader.onload = () => {
                    setImagemParaCortar(reader.result as string);
                    setCropModalAberto(true);
                  };
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }
              }} className="text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-bold file:bg-[var(--bg-surface2)] file:text-white hover:file:bg-zinc-700 cursor-pointer" />
            </div>
          </div>
          <div><label className="input-label">Nome</label>
          <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="ds-input" /></div>
          <div><label className="input-label">Email</label>
          <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="ds-input" /></div>
          <div>
            <label className="input-label">Senha {editandoId ? "(deixe em branco para manter)" : ""}</label>
            <input type="password" value={form.senha} onChange={e => setForm({...form, senha: e.target.value})} className="ds-input" placeholder={editandoId ? "Nova senha" : "Senha"} />
          </div>
          <div><label className="input-label">Especialidades (vírgula)</label>
          <input value={form.especialidades} onChange={e => setForm({...form, especialidades: e.target.value})} placeholder="Corte, Barba" className="ds-input" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div><label className="input-label">Comissão (%)</label>
            <input type="number" value={form.comissaoPercent} onChange={e => setForm({...form, comissaoPercent: e.target.value})} className="ds-input" /></div>
            <div><label className="input-label">Cor</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.cor} onChange={e => setForm({...form, cor: e.target.value})} style={{ width: '38px', height: '38px', padding: '0', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }} />
              <input type="text" value={form.cor} onChange={e => setForm({...form, cor: e.target.value})} className="ds-input flex-1" style={{ textTransform: 'uppercase' }} />
            </div></div>
          </div>
          <button onClick={salvarBarbeiro} className="btn-primary w-full justify-center">{editandoId ? "Salvar Alterações" : "Cadastrar"}</button>
        </div>
      </Modal>

      <ImageCropperModal
        aberto={cropModalAberto}
        onFechar={() => setCropModalAberto(false)}
        imageSrc={imagemParaCortar}
        onCropComplete={async (croppedBlob) => {
          setCropModalAberto(false);
          const formData = new FormData();
          formData.append('file', croppedBlob, 'avatar.jpeg');
          try {
            const res = await api.post('/upload/barbeiro', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
            setForm({ ...form, foto: res.data.url });
          } catch (error: any) { 
            console.error(error);
            alert(error?.response?.data?.erro || 'Erro ao fazer upload da foto'); 
          }
        }}
      />
    </div>
  );
}
