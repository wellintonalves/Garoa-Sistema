// Tela de login do barbeiro — /barbeiro/login
// Visual sóbrio com "Área do Barbeiro" no topo
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBarbeiroAuth } from '../../hooks/useBarbeiroAuth';
import { Mail, Lock, AlertCircle, Scissors, ArrowLeft } from 'lucide-react';

export function BarbeiroLoginPage() {
  const navigate = useNavigate();
  const { login } = useBarbeiroAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  
  
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
      background: '#0F172A',
    }}>
      <div className="animate-fade-in" style={{
        width: '100%',
        maxWidth: '420px',
      }}>
        {/* Card principal */}
        <div style={{
          background: '#1E293B',
          border: '1px solid #334155',
          borderTop: '2px solid #F59E0B',
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
              background: 'rgba(245, 158, 11, 0.10)',
              marginBottom: '1rem',
            }}>
              <Scissors size={24} style={{ color: '#F59E0B' }} />
            </div>

            <h1 style={{
              fontFamily: 'var(--fonte-interface)',
              fontSize: '32px',
              letterSpacing: '0.06em',
              color: '#FFFFFF',
              lineHeight: 1,
            }}>
              Área do Barbeiro
            </h1>

            <p style={{
              fontFamily: 'var(--fonte-interface)',
              fontSize: '10px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase' as const,
              color: '#94A3B8',
              marginTop: '8px',
            }}>
              Acesso restrito
            </p>

            {/* Linha decorativa */}
            <div style={{
              width: '40px',
              height: '2px',
              background: '#F59E0B',
              marginTop: '16px',
            }} />
          </div>

          {/* Formulário de Login */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="input-label">Email</label>
              <div className="relative">
                <Mail size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                <input
                  id="barbeiro-login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full bg-[#1E293B] border border-[#334155] rounded text-[#FFFFFF] placeholder-[#64748B] focus:outline-none focus:border-[#F59E0B] py-2.5"
                  style={{ paddingLeft: '36px' }}
                />
              </div>
            </div>

            <div>
              <label className="input-label">Senha</label>
              <div className="relative">
                <Lock size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                <input
                  id="barbeiro-login-senha"
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#1E293B] border border-[#334155] rounded text-[#FFFFFF] placeholder-[#64748B] focus:outline-none focus:border-[#F59E0B] py-2.5"
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
                  fontFamily: 'var(--fonte-interface)',
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
              className="flex items-center gap-2 py-3 bg-[#F59E0B] hover:bg-[#D97706] text-[#0F172A] font-bold uppercase tracking-widest text-xs rounded transition-colors w-full justify-center"
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
              fontFamily: 'var(--fonte-interface)',
              fontSize: '11px',
              letterSpacing: '0.1em',
              color: '#94A3B8',
              textTransform: 'uppercase' as const,
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = '#F59E0B';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = '#94A3B8';
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
