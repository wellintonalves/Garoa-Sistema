// Aba Perfil do cliente — dados editáveis, barbearias conectadas, logout
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClienteAuth } from '../../../hooks/useClienteAuth';
import { User, Phone, Mail, LogOut, Unlink, Scissors, Save } from 'lucide-react';
import clienteApi from '../../../api/clienteApi';

interface PerfilData {
  id: string;
  telefone: string | null;
  usuario: { id: string; nome: string; email: string };
}

interface BarbeariaConectada {
  id: string;
  nome: string;
  slug: string;
}

export function ClienteBarbeariaPerfil() {
  const navigate = useNavigate();
  const { logout } = useClienteAuth();
  const [perfil, setPerfil] = useState<PerfilData | null>(null);
  const [barbearias, setBarbearias] = useState<BarbeariaConectada[]>([]);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    clienteApi.get<PerfilData>('/cliente/perfil').then(res => {
      setPerfil(res.data);
      setNome(res.data.usuario.nome);
      setTelefone(res.data.telefone || '');
    });
    clienteApi.get<BarbeariaConectada[]>('/cliente/minhas-barbearias').then(res => setBarbearias(res.data));
  }, []);

  async function salvar() {
    setSalvando(true);
    setMensagem('');
    try {
      await clienteApi.put('/cliente/perfil', { nome, telefone });
      setMensagem('Perfil atualizado!');
      setTimeout(() => setMensagem(''), 3000);
    } catch { setMensagem('Erro ao salvar'); }
    finally { setSalvando(false); }
  }

  async function desconectar(barbeariaId: string) {
    if (!confirm('Desconectar desta barbearia?')) return;
    try {
      await clienteApi.delete(`/cliente/desconectar-barbearia/${barbeariaId}`);
      setBarbearias(prev => prev.filter(b => b.id !== barbeariaId));
    } catch { /* empty */ }
  }

  function handleLogout() {
    logout();
    navigate('/cliente');
  }

  return (
    <div className="px-5 py-6 animate-fade-in">
      <h1 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '24px', color: 'var(--text-primary)', marginBottom: '24px', letterSpacing: '0.04em' }}>
        Meu Perfil
      </h1>

      {/* Dados editáveis */}
      <div className="flex flex-col gap-4 mb-8">
        <div>
          <label className="input-label"><User size={10} className="inline mr-1" />Nome</label>
          <input value={nome} onChange={e => setNome(e.target.value)} className="ds-input" />
        </div>
        <div>
          <label className="input-label"><Phone size={10} className="inline mr-1" />WhatsApp</label>
          <input value={telefone} onChange={e => setTelefone(e.target.value)} className="ds-input" placeholder="(11) 99999-9999" />
        </div>
        <div>
          <label className="input-label"><Mail size={10} className="inline mr-1" />Email</label>
          <input value={perfil?.usuario.email || ''} disabled className="ds-input" style={{ opacity: 0.5 }} />
        </div>

        {mensagem && (
          <p style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '11px', color: mensagem.includes('Erro') ? 'var(--error-text)' : 'var(--success-text)' }}>
            {mensagem}
          </p>
        )}

        <button onClick={salvar} disabled={salvando} className="btn-primary w-full justify-center">
          <Save size={14} /> {salvando ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>

      {/* Barbearias conectadas */}
      <div className="mb-8">
        <h2 style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'var(--cor-icone)', marginBottom: '12px' }}>
          Barbearias Conectadas
        </h2>
        <div className="flex flex-col gap-2">
          {barbearias.map(b => (
            <div key={b.id} className="flex items-center justify-between p-3"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                <Scissors size={16} style={{ color: 'var(--cor-icone)' }} />
                <span style={{ fontFamily: 'var(--fonte-interface)', fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>{b.nome}</span>
              </div>
              <button onClick={() => desconectar(b.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error-text)', padding: '4px' }}
                title="Desconectar">
                <Unlink size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Botão sair */}
      <button onClick={handleLogout}
        className="btn-secondary w-full justify-center"
        style={{ color: 'var(--error-text)', borderColor: 'var(--error)' }}>
        <LogOut size={14} /> Sair da Conta
      </button>
    </div>
  );
}
