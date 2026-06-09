// Tela de login do barbeiro — /barbeiro/login
// Visual sóbrio com "Área do Barbeiro" no topo
import { useState, type FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBarbeiroAuth } from '../../hooks/useBarbeiroAuth';
import { useTema } from '../../hooks/useTema';
import { Mail, Lock, AlertCircle, Scissors, ArrowLeft } from 'lucide-react';

export function BarbeiroLoginPage() {
  const navigate = useNavigate();
  const { login } = useBarbeiroAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const { limparTema } = useTema();

  useEffect(() => {
    limparTema();
  }, [limparTema]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await login(email, senha);
      navigate('/barbeiro/hoje');
    } catch (error) {
      const msg = (error as { response?: { data?: { erro?: string } } })?.response?.data?.erro || 'Erro ao fazer login';
      setErro(msg);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      background: 'var(--bg-primary)',
    }}>
      <div className="animate-fade-in" style={{
        width: '100%',
        maxWidth: '420px',
      }}>
        {/* Card principal */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderTop: '2px solid var(--amber)',
          padding: '2.5rem',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '2rem',
          }}>
            <div style={{
              width: '52px',
              height: '52px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--amber-dim)',
              marginBottom: '1rem',
            }}>
              <Scissors size={24} style={{ color: 'var(--cor-icone)' }} />
            </div>

            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '32px',
              letterSpacing: '0.06em',
              color: 'var(--text-primary)',
              lineHeight: 1,
            }}>
              Área do Barbeiro
            </h1>

            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase' as const,
              color: 'var(--text-muted)',
              marginTop: '8px',
            }}>
              Acesso restrito
            </p>

            {/* Linha decorativa */}
            <div style={{
              width: '40px',
              height: '2px',
              background: 'var(--amber)',
              marginTop: '16px',
            }} />
          </div>

          {/* Formulário de Login */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="input-label">Email</label>
              <div className="relative">
                <Mail size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  id="barbeiro-login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="ds-input"
                  style={{ paddingLeft: '36px' }}
                />
              </div>
            </div>

            <div>
              <label className="input-label">Senha</label>
              <div className="relative">
                <Lock size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  id="barbeiro-login-senha"
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="ds-input"
                  style={{ paddingLeft: '36px' }}
                />
              </div>
            </div>

            {/* Erro */}
            {erro && (
              <div
                className="animate-fade-in"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px',
                  background: 'var(--error)',
                  border: '1px solid var(--error-text)',
                  color: 'var(--error-text)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                }}
              >
                <AlertCircle size={14} strokeWidth={1.5} className="flex-shrink-0" />
                <span>{erro}</span>
              </div>
            )}

            <button
              id="barbeiro-login-submit"
              type="submit"
              disabled={enviando}
              className="btn-primary w-full justify-center"
            >
              {enviando ? 'Entrando...' : 'Entrar como Barbeiro'}
            </button>
          </form>
        </div>

        {/* Link Voltar */}
        <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
          <button
            id="barbeiro-voltar"
            type="button"
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.1em',
              color: 'var(--text-muted)',
              textTransform: 'uppercase' as const,
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--amber)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
            }}
          >
            <ArrowLeft size={14} strokeWidth={1.5} />
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
