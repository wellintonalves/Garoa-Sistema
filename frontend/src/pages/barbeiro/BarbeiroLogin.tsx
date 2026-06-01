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
      style={{ background: 'var(--bg-primary)' }}>

      {/* Logo */}
      <div className="flex flex-col items-center mt-12 mb-10 animate-fade-in">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: 'var(--amber-dim)' }}>
          <Scissors size={36} style={{ color: 'var(--amber)' }} />
        </div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '28px',
          letterSpacing: '0.04em',
          color: 'var(--text-primary)',
        }}>
          Portal do Barbeiro
        </h1>
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.1em',
          color: 'var(--text-muted)',
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
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
          }}>{erro}</div>
        )}

        <div>
          <label className="input-label">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="ds-input"
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
            className="ds-input"
            placeholder="••••••••"
            required
          />
        </div>

        <button type="submit" disabled={enviando}
          className="btn-primary w-full justify-center"
          style={{ padding: '14px', fontSize: '13px', marginTop: '8px' }}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
