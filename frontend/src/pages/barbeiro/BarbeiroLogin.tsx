// Tela de login do barbeiro
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBarbeiroAuth } from '../../hooks/useBarbeiroAuth';
import { Scissors } from 'lucide-react';

export function BarbeiroLogin() {
  const navigate = useNavigate();
  const { login } = useBarbeiroAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await login(email, senha);
      navigate('/barbeiro/hoje');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { erro?: string } } };
      setErro(axiosErr.response?.data?.erro || 'Erro ao fazer login');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen px-6 py-8"
      style={{ background: '#0F172A' }}>

      {/* Logo */}
      <div className="flex flex-col items-center mt-12 mb-10 animate-fade-in">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: 'rgba(245, 158, 11, 0.10)' }}>
          <Scissors size={36} style={{ color: '#F59E0B' }} />
        </div>
        <h1 style={{
          fontFamily: 'var(--fonte-interface)',
          fontSize: '28px',
          letterSpacing: '0.04em',
          color: '#FFFFFF',
        }}>
          Portal do Barbeiro
        </h1>
        <p style={{
          fontFamily: 'var(--fonte-interface)',
          fontSize: '11px',
          letterSpacing: '0.1em',
          color: '#94A3B8',
          marginTop: '8px',
          textTransform: 'uppercase'
        }}>
          Garoa Barbearia
        </p>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full max-w-sm mx-auto animate-fade-in" style={{ animationDelay: '0.1s' }}>
        {erro && (
          <div style={{
            background: 'var(--error)',
            color: 'var(--error-text)',
            padding: '10px 14px',
            fontFamily: 'var(--fonte-interface)',
            fontSize: '11px',
          }}>{erro}</div>
        )}

        <div>
          <label className="input-label">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#1E293B] border border-[#334155] rounded text-[#FFFFFF] placeholder-[#64748B] focus:outline-none focus:border-[#F59E0B] py-2.5"
            placeholder="seu@email.com"
            required
          />
        </div>

        <div>
          <label className="input-label">Senha</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full bg-[#1E293B] border border-[#334155] rounded text-[#FFFFFF] placeholder-[#64748B] focus:outline-none focus:border-[#F59E0B] py-2.5"
            placeholder="••••••••"
            required
          />
        </div>

        <button type="submit" disabled={enviando}
          className="flex items-center gap-2 py-3 bg-[#F59E0B] hover:bg-[#D97706] text-[#0F172A] font-bold uppercase tracking-widest text-xs rounded transition-colors w-full justify-center"
          style={{ padding: '14px', fontSize: '13px', marginTop: '8px' }}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
