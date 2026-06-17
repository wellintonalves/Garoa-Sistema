// Aba Perfil do barbeiro — dados do profissional e logout
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBarbeiroAuth } from '../../hooks/useBarbeiroAuth';
import { User, Scissors, LogOut } from 'lucide-react';
import barbeiroApi from '../../api/barbeiroApi';

interface PerfilBarbeiro {
  id: string;
  foto: string | null;
  especialidades: string[];
  comissaoPercent: number;
  usuario: { nome: string; email: string };
  barbearia: { nome: string; slug: string; logo: string | null };
}

export function BarbeiroPerfil() {
  const navigate = useNavigate();
  const { logout } = useBarbeiroAuth();
  const [perfil, setPerfil] = useState<PerfilBarbeiro | null>(null);

  useEffect(() => {
    barbeiroApi.get<PerfilBarbeiro>('/barbeiro/perfil').then(res => setPerfil(res.data));
  }, []);

  function handleLogout() {
    logout();
    navigate('/barbeiro');
  }

  if (!perfil) return <div className="p-6 text-center text-gray-500">Carregando...</div>;

  return (
    <div className="px-5 py-6 animate-fade-in">
      <h1 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '24px', color: 'var(--text-primary)', marginBottom: '24px', letterSpacing: '0.04em' }}>
        Meu Perfil
      </h1>

      {/* Avatar e Nome */}
      <div className="flex flex-col items-center mb-8">
        {perfil.foto ? (
          <img 
            src={perfil.foto} 
            alt={perfil.usuario.nome} 
            className="w-24 h-24 rounded-full object-cover mb-4"
            style={{ border: '2px solid rgba(var(--cor-primaria-rgb), 0.30)' }} 
          />
        ) : (
          <div 
            className="w-24 h-24 rounded-full flex items-center justify-center mb-4"
            style={{ 
              background: 'rgba(var(--cor-primaria-rgb), 0.10)', 
              border: '2px solid rgba(var(--cor-primaria-rgb), 0.30)', 
              fontFamily: 'var(--fonte-interface)', 
              fontSize: '32px', 
              color: 'var(--cor-primaria)' 
            }}>
            {perfil.usuario.nome.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
        )}
        <h2 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {perfil.usuario.nome}
        </h2>
        <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
          {perfil.usuario.email}
        </p>
      </div>

      {/* Info do Profissional */}
      <div className="flex flex-col gap-4 mb-8">
        <div className="p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 mb-2">
            <User size={16} style={{ color: 'var(--cor-icone)' }} />
            <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Comissão Padrão</span>
          </div>
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '16px', color: 'var(--text-primary)' }}>
            {perfil.comissaoPercent}%
          </p>
        </div>

        <div className="p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 mb-3">
            <Scissors size={16} style={{ color: 'var(--cor-icone)' }} />
            <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Especialidades</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {perfil.especialidades.map((e, i) => (
              <span key={i} className="badge badge-info">{e}</span>
            ))}
          </div>
        </div>
      </div>

      <button onClick={handleLogout}
        className="btn-secondary w-full justify-center"
        style={{ color: 'var(--error-text)', borderColor: 'var(--error)' }}>
        <LogOut size={14} /> Sair da Conta
      </button>

      {/* Footer Info */}
      <div className="mt-8 text-center">
        <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-disabled)' }}>
          Vinculado a: <br />
          <strong style={{ color: 'var(--text-muted)' }}>{perfil.barbearia.nome}</strong>
        </p>
      </div>
    </div>
  );
}
