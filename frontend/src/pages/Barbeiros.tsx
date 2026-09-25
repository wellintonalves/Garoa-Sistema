// Página de Barbeiros — listagem com cards + seção de comissões por período
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Star, Plus, CurrencyDollar, PencilSimple, Trash, Power, Clock } from '@phosphor-icons/react';
import { Modal } from '../components/Modal';
import { Botao } from '../components/ui/Botao';
import { ImageCropperModal } from '../components/ImageCropperModal';

import { SkeletonPage } from '../components/Skeleton';
import { ProducaoBarbeiros } from '../components/ProducaoBarbeiros';
import { ErrorBoundary } from '../components/ErrorBoundary';
import api from '../api/client';
import { CORES_REFERENCIA } from '../styles/tokens';
import { BarbeiroHorariosCard, type DiaConfig } from './barbeiro/BarbeiroHorariosCard';

interface Barbeiro {
  id: string;
  foto: string | null;
  especialidades: string[];
  comissaoPercent: number;
  cor: string;
  ativo: boolean;
  horariosTrabalho?: any;
  usuario: { id: string; nome: string; email: string };
  _count?: {
    agendamentos: number;
    lancamentos: number;
  };
}


export function Barbeiros() {
  const [barbeiros, setBarbeiros] = useState<Barbeiro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [cropModalAberto, setCropModalAberto] = useState(false);
  const [imagemParaCortar, setImagemParaCortar] = useState<string>('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [confirmandoDesativacao, setConfirmandoDesativacao] = useState<Barbeiro | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<Barbeiro | null>(null);
  const [configurandoJornada, setConfigurandoJornada] = useState<Barbeiro | null>(null);
  const [nomeConfirmacao, setNomeConfirmacao] = useState('');
  const [form, setForm] = useState({ nome: '', email: '', senha: '', foto: '', especialidades: '', comissaoPercent: '50', cor: CORES_REFERENCIA.corPadraoBarbeiro });
  const [producaoParams] = useSearchParams();
  const [erroLista, setErroLista] = useState('');

  async function carregar(signal?: AbortSignal) {
    setErroLista('');
    try {
      const res = await api.get<Barbeiro[]>('/barbeiros?todos=true', { signal });
      if (!signal?.aborted) setBarbeiros(res.data ?? []);
    } catch (err) { if (!signal?.aborted) setErroLista(err instanceof Error ? err.message : 'Não foi possível carregar os barbeiros.'); }
    finally { if (!signal?.aborted) setCarregando(false); }
  }

  useEffect(() => { const controller = new AbortController(); carregar(controller.signal); return () => controller.abort(); }, []);

  function abrirModalNovo() {
    setEditandoId(null);
    setForm({ nome: '', email: '', senha: '', foto: '', especialidades: '', comissaoPercent: '50', cor: CORES_REFERENCIA.corPadraoBarbeiro });
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
      cor: b.cor || CORES_REFERENCIA.corPadraoBarbeiro,
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
      setForm({ nome: '', email: '', senha: '', foto: '', especialidades: '', comissaoPercent: '50', cor: CORES_REFERENCIA.corPadraoBarbeiro });
      carregar();
    } catch (err: any) {
      console.error(err);
      const mensagem = err?.response?.data?.erro || err?.message || 'Erro ao salvar barbeiro.';
      alert(mensagem);
    }
  }

  async function desativarBarbeiro(id: string) {
    try {
      await api.delete(`/barbeiros/${id}`);
      setConfirmandoDesativacao(null);
      carregar();
    } catch (err: any) {
      alert(err?.response?.data?.erro || 'Erro ao desativar barbeiro.');
    }
  }

  async function apagarBarbeiroPermanente(id: string) {
    if (confirmandoExclusao && nomeConfirmacao !== confirmandoExclusao.usuario.nome) {
      alert('O nome digitado não confere.');
      return;
    }
    try {
      await api.delete(`/barbeiros/${id}/permanente`);
      setConfirmandoExclusao(null);
      setNomeConfirmacao('');
      carregar();
    } catch (err: any) {
      alert(err?.response?.data?.erro || 'Erro ao excluir barbeiro.');
    }
  }


  // Pega iniciais do nome para avatar
  function getIniciais(nome: string) {
    return nome.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }

  if (carregando) return <SkeletonPage />;
  if (erroLista) return <div role="alert"><p>{erroLista}</p><button className="btn-primary min-h-[48px]" onClick={() => carregar()}>Tentar novamente</button></div>;

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
          <Plus size={14} /> Novo
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '12px' }}>
        {(barbeiros ?? []).map(b => {
          const totalHistorico = b._count ? b._count.agendamentos + (b._count.lancamentos || 0) : 0;
          return (
          <div
            key={b.id}
            className="card barbeiro-perfil min-w-0"
          >
            <div className="flex items-start gap-4 mb-4">
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
                    color: 'var(--cor-primaria-texto)',
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
                    fontSize: '16px',
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
                    fontSize: '12px',
                    color: 'var(--texto-secundario)',
                    letterSpacing: '0',
                  }}
                >
                  {b.usuario.email}
                </p>
                <p
                  className="truncate"
                  style={{
                    fontFamily: 'var(--fonte-interface)',
                    fontSize: '12px',
                    color: totalHistorico > 0 ? 'var(--texto-secundario)' : 'var(--amber)',
                    letterSpacing: '0',
                    marginTop: '2px',
                    fontWeight: 500
                  }}
                >
                  {totalHistorico > 0 ? `${totalHistorico} registro${totalHistorico !== 1 ? 's' : ''} no histórico` : 'Sem histórico'}
                </p>
              </div>
              {/* Indicadores */}
              <div className="ml-auto flex-shrink-0">
                <div
                  className="flex-shrink-0 badge"
                  style={b.ativo
                    ? { background: 'var(--sucesso-fundo)', color: 'var(--sucesso)' }
                    : { background: 'var(--bg-surface2)', color: 'var(--text-disabled)' }
                  }
                >
                  {b.ativo ? 'Ativo' : 'Inativo'}
                </div>
              </div>
            </div>
            {!b.horariosTrabalho && (
              <button
                type="button"
                onClick={() => setConfigurandoJornada(b)}
                className="w-full min-h-[44px] max-md:min-h-[48px] flex items-center justify-between gap-3 px-3 py-2 mb-3 transition-colors"
                style={{
                  fontFamily: 'var(--fonte-interface)',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--cor-primaria-texto)',
                  background: 'rgba(var(--cor-primaria-rgb), 0.08)',
                  border: '1px solid rgba(var(--cor-primaria-rgb), 0.25)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
                title="A agenda está usando os horários gerais da barbearia"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Clock size={16} className="flex-shrink-0" />
                  <span className="truncate">Jornada não configurada</span>
                </span>
                <span className="whitespace-nowrap">Configurar</span>
              </button>
            )}
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                onClick={() => abrirModalEditar(b)}
                className="btn-secondary flex-1 min-h-[44px] max-md:min-h-[48px] px-3 py-2"
                style={{ fontSize: '12px' }}
              >
                <PencilSimple size={16} /> Editar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (b.ativo) {
                    setConfirmandoDesativacao(b);
                  } else {
                    api.put(`/barbeiros/${b.id}`, { ativo: true }).then(() => carregar());
                  }
                }}
                className="btn-secondary flex-1 min-h-[44px] max-md:min-h-[48px] px-3 py-2"
                style={{ fontSize: '12px' }}
              >
                <Power size={16} /> {b.ativo ? 'Desativar' : 'Reativar'}
              </button>
              {totalHistorico === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmandoExclusao(b);
                    setNomeConfirmacao('');
                  }}
                  className="btn-secondary flex-1 min-h-[44px] max-md:min-h-[48px] px-3 py-2"
                  style={{ fontSize: '12px', color: 'var(--perigo)' }}
                >
                  <Trash size={16} /> Excluir
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(b.especialidades ?? []).map((e, i) => (
                <span
                  key={i}
                  className="badge"
                  style={{ background: 'var(--bg-surface2)', color: 'var(--texto-secundario)' }}
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
                <Star size={14} /> <span>Comissão: {b.comissaoPercent}%</span>
              </div>
              <Link
                to={`/admin/barbeiros/${b.id}/producao?${producaoParams.toString()}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 transition-colors min-h-[48px]"
                style={{
                  fontFamily: 'var(--fonte-interface)',
                  fontSize: '11px',
                  letterSpacing: '0.02em',
                  textTransform: 'none',
                  color: 'var(--texto-secundario)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--amber)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--texto-secundario)'; }}
                title="Ver comissões em nova aba"
              >
                <CurrencyDollar size={14} /> Ver comissões
              </Link>
            </div>
          </div>
          );
        })}
      </div>

      <ErrorBoundary><ProducaoBarbeiros /></ErrorBoundary>

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
              }} className="text-sm text-[var(--texto-secundario)] file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-bold file:bg-[var(--bg-surface2)] file:text-[var(--texto-principal)] hover:file:bg-[var(--superficie-2)] border-[var(--borda)] cursor-pointer" />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="input-label">Comissão (%)</label>
            <input type="number" value={form.comissaoPercent} onChange={e => setForm({...form, comissaoPercent: e.target.value})} className="ds-input" /></div>
            <div><label className="input-label">Cor</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.cor} onChange={e => setForm({...form, cor: e.target.value})} style={{ width: '38px', height: '38px', padding: '0', border: '1px solid var(--borda-forte)', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }} />
              <input type="text" value={form.cor} onChange={e => setForm({...form, cor: e.target.value})} className="ds-input flex-1" />
            </div></div>
          </div>
          <button onClick={salvarBarbeiro} className="btn-primary w-full justify-center">{editandoId ? "Salvar Alterações" : "Cadastrar"}</button>
        </div>
      </Modal>

      <Modal
        aberto={!!configurandoJornada}
        onFechar={() => setConfigurandoJornada(null)}
        titulo={configurandoJornada ? `Configurar jornada de ${configurandoJornada.usuario.nome}` : 'Configurar jornada'}
        largura="max-w-5xl"
      >
        {configurandoJornada && (
          <BarbeiroHorariosCard
            horariosIniciais={configurandoJornada.horariosTrabalho}
            titulo="Horários de trabalho"
            onSalvar={async (horarios: Record<string, DiaConfig>) => {
              await api.put(`/barbeiros/${configurandoJornada.id}`, { horariosTrabalho: horarios });
            }}
            onSuccess={() => {
              setConfigurandoJornada(null);
              carregar();
            }}
            mostrarErro={(mensagem) => alert(mensagem)}
            mostrarSucesso={(mensagem) => alert(mensagem)}
          />
        )}
      </Modal>

      {/* Modal de confirmação de desativação */}
      <Modal aberto={!!confirmandoDesativacao} onFechar={() => setConfirmandoDesativacao(null)} titulo="Desativar Barbeiro">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Tem certeza que deseja desativar <strong style={{ color: 'var(--text-primary)' }}>{confirmandoDesativacao?.usuario.nome}</strong>?
            <br />Ele não aparecerá mais na agenda para novos agendamentos, mas continuará nos relatórios históricos.
          </p>
          <div className="flex gap-3 justify-end">
            <Botao
              variante="fantasma"
              onClick={() => setConfirmandoDesativacao(null)}
            >
              Cancelar
            </Botao>
            <Botao
              variante="destrutivo"
              onClick={() => confirmandoDesativacao && desativarBarbeiro(confirmandoDesativacao.id)}
            >
              Desativar
            </Botao>
          </div>
        </div>
      </Modal>

      {/* Modal de confirmação de exclusão PERMANENTE */}
      <Modal aberto={!!confirmandoExclusao} onFechar={() => { setConfirmandoExclusao(null); setNomeConfirmacao(''); }} titulo="Excluir Permanentemente">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Você está prestes a excluir <strong style={{ color: 'var(--perigo)' }}>{confirmandoExclusao?.usuario.nome}</strong>.
            <br />Esta ação é <strong>irreversível</strong> e removerá todos os dados do barbeiro.
          </p>
          
          <div>
            <label className="input-label mb-2 block">
              Para confirmar, digite <strong>{confirmandoExclusao?.usuario.nome}</strong> abaixo:
            </label>
            <input 
              type="text" 
              value={nomeConfirmacao} 
              onChange={e => setNomeConfirmacao(e.target.value)} 
              className="ds-input w-full" 
              placeholder={confirmandoExclusao?.usuario.nome}
            />
          </div>

          <div className="flex gap-3 justify-end mt-2">
            <Botao
              variante="fantasma"
              onClick={() => { setConfirmandoExclusao(null); setNomeConfirmacao(''); }}
            >
              Cancelar
            </Botao>
            <Botao
              variante="destrutivo"
              disabled={nomeConfirmacao !== confirmandoExclusao?.usuario.nome}
              onClick={() => confirmandoExclusao && apagarBarbeiroPermanente(confirmandoExclusao.id)}
            >
              Excluir
            </Botao>
          </div>
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
