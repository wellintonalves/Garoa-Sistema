import { useState, useEffect, useRef } from 'react';
import { useBarbeiroAuth } from '../../hooks/useBarbeiroAuth';
import { useModoTema } from '../../hooks/useModoTema';
import { User, Scissors, LogOut, Sun, Moon, Monitor, Camera, Phone, Star, Save, Clock } from 'lucide-react';
import barbeiroApi from '../../api/barbeiroApi';

interface PerfilBarbeiro {
  id: string;
  foto: string | null;
  especialidades: string[];
  comissaoPercent: number;
  telefone: string | null;
  horariosTrabalho: any;
  avaliacaoMedia: number;
  usuario: { nome: string; email: string };
  barbearia: { nome: string; slug: string; logo: string | null };
}

export function BarbeiroPerfil() {
  const { logout } = useBarbeiroAuth();
  const { modo, setModo } = useModoTema();
  const [perfil, setPerfil] = useState<PerfilBarbeiro | null>(null);
  
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    nome: '',
    telefone: '',
    especialidades: ''
  });
  
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sucessoMsg, setSucessoMsg] = useState('');
  const [erroMsg, setErroMsg] = useState('');

  const mostrarErro = (msg: string) => { setErroMsg(msg); setTimeout(() => setErroMsg(''), 4000); };
  const mostrarSucesso = (msg: string) => { setSucessoMsg(msg); setTimeout(() => setSucessoMsg(''), 3000); };

  function carregarPerfil() {
    barbeiroApi.get<PerfilBarbeiro>('/barbeiro/perfil').then(res => {
      setPerfil(res.data);
      setForm({
        nome: res.data.usuario.nome,
        telefone: res.data.telefone || '',
        especialidades: res.data.especialidades.join(', ')
      });
    }).catch(() => mostrarErro('Erro ao carregar perfil'));
  }

  useEffect(() => {
    carregarPerfil();
  }, []);

  function handleLogout() {
    logout();
    window.location.href = '/barbeiro/login';
  }

  async function salvarPerfil() {
    setSalvando(true);
    setErroMsg('');
    try {
      const especialidadesArray = form.especialidades.split(',').map(s => s.trim()).filter(Boolean);
      await barbeiroApi.put('/barbeiro/perfil', {
        nome: form.nome,
        telefone: form.telefone,
        especialidades: especialidadesArray
      });
      mostrarSucesso('Perfil atualizado com sucesso!');
      setEditando(false);
      carregarPerfil();
    } catch (err: any) {
      mostrarErro(err.response?.data?.erro || 'Erro ao salvar perfil');
    } finally {
      setSalvando(false);
    }
  }

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    setUploading(true);
    setErroMsg('');
    try {
      await barbeiroApi.post('/barbeiro/foto', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      mostrarSucesso('Foto atualizada com sucesso!');
      carregarPerfil();
    } catch (err: any) {
      mostrarErro(err.response?.data?.erro || 'Erro ao fazer upload da foto');
    } finally {
      setUploading(false);
    }
  }

  if (!perfil) return (
    <div className="flex justify-center py-20" style={{ color: 'var(--text-muted)', fontFamily: 'var(--fonte-interface)' }}>
      Carregando...
    </div>
  );

  return (
    <div className="px-4 py-6 md:px-8 max-w-3xl mx-auto animate-fade-in" style={{ fontFamily: 'var(--fonte-interface)' }}>
      
      {/* Feedbacks */}
      {sucessoMsg && (
        <div className="bg-green-100 text-green-800 p-3 rounded-lg mb-4 text-sm font-medium border border-green-200">
          {sucessoMsg}
        </div>
      )}
      {erroMsg && (
        <div className="bg-red-100 text-red-800 p-3 rounded-lg mb-4 text-sm font-medium border border-red-200">
          {erroMsg}
        </div>
      )}

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Meu Perfil
        </h1>
        {!editando ? (
          <button onClick={() => setEditando(true)} className="btn-secondary text-xs px-4 py-2">
            Editar Perfil
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setEditando(false)} className="btn-secondary text-xs px-3 py-2" disabled={salvando}>Cancelar</button>
            <button onClick={salvarPerfil} className="btn-primary text-xs px-3 py-2" disabled={salvando}>
              {salvando ? 'Salvando...' : <><Save size={14} /> Salvar</>}
            </button>
          </div>
        )}
      </div>

      {/* Avatar e Nome */}
      <div className="flex flex-col items-center mb-8 relative">
        <div className="relative group">
          {perfil.foto ? (
            <img 
              src={perfil.foto} 
              alt={perfil.usuario.nome} 
              className="w-28 h-28 rounded-full object-cover mb-4 shadow-lg transition-all"
              style={{ border: '2px solid var(--cor-primaria)' }} 
            />
          ) : (
            <div 
              className="w-28 h-28 rounded-full flex items-center justify-center mb-4 shadow-lg"
              style={{ 
                background: 'var(--bg-surface)', 
                border: '2px solid var(--cor-primaria)', 
                fontSize: '32px', 
                color: 'var(--cor-primaria)' 
              }}>
              {perfil.usuario.nome.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
          )}
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-4 right-0 p-2 rounded-full shadow-md hover:scale-110 transition-transform"
            style={{ background: 'var(--cor-primaria)', color: '#fff' }}
            title="Alterar Foto"
          >
            {uploading ? <Clock size={16} className="animate-spin" /> : <Camera size={16} />}
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFotoChange} accept="image/*" className="hidden" />
        </div>
        
        {!editando ? (
          <>
            <h2 className="text-xl font-bold mt-2" style={{ color: 'var(--text-primary)' }}>
              {perfil.usuario.nome}
            </h2>
            <div className="flex items-center gap-3 mt-2">
              <span className="flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--cor-primaria)' }}>
                <Star size={14} fill="currentColor" /> {Number(perfil.avaliacaoMedia).toFixed(1)}
              </span>
              <span className="w-1 h-1 rounded-full bg-current opacity-50" style={{ color: 'var(--text-muted)' }}></span>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {perfil.usuario.email}
              </span>
            </div>
          </>
        ) : (
          <div className="w-full max-w-sm mt-4 space-y-3">
            <div>
              <label className="input-label">Nome de Exibição</label>
              <input type="text" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="ds-input" />
            </div>
            <div>
              <label className="input-label">Email (Não editável)</label>
              <input type="text" value={perfil.usuario.email} disabled className="ds-input opacity-50 cursor-not-allowed" />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        
        {/* Detalhes de Contato */}
        <div className="p-6 rounded-2xl border flex flex-col gap-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'var(--bg-surface2)' }}><Phone size={16} style={{ color: 'var(--cor-primaria)' }} /></div>
            <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>Contato</span>
          </div>
          
          {!editando ? (
            <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
              {perfil.telefone || <span className="text-sm opacity-50 italic">Não informado</span>}
            </p>
          ) : (
            <input type="text" placeholder="(11) 99999-9999" value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} className="ds-input mt-2" />
          )}
        </div>

        {/* Especialidades */}
        <div className="p-6 rounded-2xl border flex flex-col gap-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'var(--bg-surface2)' }}><Scissors size={16} style={{ color: 'var(--cor-primaria)' }} /></div>
            <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>Especialidades</span>
          </div>
          
          {!editando ? (
            <div className="flex flex-wrap gap-2 mt-1">
              {perfil.especialidades.length > 0 ? perfil.especialidades.map((e, i) => (
                <span key={i} className="px-3 py-1 text-xs font-medium rounded-full" style={{ background: 'var(--bg-surface2)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>{e}</span>
              )) : (
                <span className="text-sm opacity-50 italic" style={{ color: 'var(--text-muted)' }}>Nenhuma informada</span>
              )}
            </div>
          ) : (
            <div className="mt-2">
              <input type="text" placeholder="Corte, Barba, Pigmentação..." value={form.especialidades} onChange={e => setForm({...form, especialidades: e.target.value})} className="ds-input" />
              <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>Separe por vírgulas.</p>
            </div>
          )}
        </div>

        {/* Comissão */}
        <div className="p-6 rounded-2xl border flex flex-col gap-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'var(--bg-surface2)' }}><User size={16} style={{ color: 'var(--cor-primaria)' }} /></div>
            <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>Comissão Padrão</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {perfil.comissaoPercent}%
          </p>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Definida pelo administrador da barbearia.</p>
        </div>

        {/* Horários (Placeholder para Fase 3 estendida) */}
        <div className="p-6 rounded-2xl border flex flex-col gap-4 opacity-75" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'var(--bg-surface2)' }}><Clock size={16} style={{ color: 'var(--cor-primaria)' }} /></div>
            <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>Horários de Trabalho</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Siga os horários da barbearia por enquanto. (Em breve configuração independente)
          </p>
        </div>

      </div>

      {/* Aparência */}
      <div className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
          Preferência de Tema
        </h2>
        <div className="flex rounded-xl overflow-hidden border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <button 
            onClick={() => setModo('light')}
            className={`flex-1 py-4 flex flex-col items-center gap-2 transition-colors ${modo === 'light' ? 'bg-black/5 dark:bg-white/5' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
            style={{ color: modo === 'light' ? 'var(--cor-primaria)' : 'var(--text-muted)' }}
          >
            <Sun size={20} />
            <span className="text-xs font-medium">Claro</span>
          </button>
          <div className="w-[1px]" style={{ background: 'var(--border)' }} />
          <button 
            onClick={() => setModo('dark')}
            className={`flex-1 py-4 flex flex-col items-center gap-2 transition-colors ${modo === 'dark' ? 'bg-black/5 dark:bg-white/5' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
            style={{ color: modo === 'dark' ? 'var(--cor-primaria)' : 'var(--text-muted)' }}
          >
            <Moon size={20} />
            <span className="text-xs font-medium">Escuro</span>
          </button>
          <div className="w-[1px]" style={{ background: 'var(--border)' }} />
          <button 
            onClick={() => setModo('auto')}
            className={`flex-1 py-4 flex flex-col items-center gap-2 transition-colors ${modo === 'auto' ? 'bg-black/5 dark:bg-white/5' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
            style={{ color: modo === 'auto' ? 'var(--cor-primaria)' : 'var(--text-muted)' }}
          >
            <Monitor size={20} />
            <span className="text-xs font-medium">Sistema</span>
          </button>
        </div>
      </div>

      <button onClick={handleLogout}
        className="w-full flex justify-center items-center gap-2 py-4 rounded-xl border text-sm font-medium transition-colors hover:bg-red-500/10"
        style={{ color: 'var(--error-text)', borderColor: 'var(--error-text)' }}>
        <LogOut size={16} /> Sair da Conta
      </button>

      {/* Footer Info */}
      <div className="mt-8 text-center">
        <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-disabled)' }}>
          Vinculado a <br />
          <strong className="text-sm mt-1 inline-block" style={{ color: 'var(--text-muted)' }}>{perfil.barbearia.nome}</strong>
        </p>
      </div>
    </div>
  );
}
