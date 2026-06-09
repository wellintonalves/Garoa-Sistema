// Tela de login do cliente
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClienteAuth } from '../../hooks/useClienteAuth';
import { Scissors, ArrowLeft } from 'lucide-react';

export function ClienteLogin() {
  const navigate = useNavigate();
  const { login } = useClienteAuth();
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
      navigate('/cliente/home');
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

      {/* Header */}
      <button onClick={() => navigate('/cliente')}
        className="flex items-center gap-2 mb-8"
        style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
        <ArrowLeft size={16} /> Voltar
      </button>

      {/* Logo */}
      <div className="flex flex-col items-center mb-10">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style={{ background: 'var(--amber-dim)' }}>
          <Scissors size={28} style={{ color: 'var(--cor-icone)' }} />
        </div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '28px',
          letterSpacing: '0.04em',
          color: 'var(--text-primary)',
        }}>
          Entrar
        </h1>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full max-w-sm mx-auto animate-fade-in">
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

        <div className="flex flex-col items-center gap-3 mt-4">
          <button type="button" onClick={() => navigate('/cliente/register')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: '11px',
              color: 'var(--cor-icone)', letterSpacing: '0.08em',
            }}>
            Criar conta
          </button>
        </div>
      </form>
    </div>
  );
}
