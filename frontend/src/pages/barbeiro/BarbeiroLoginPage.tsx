import { useState } from 'react';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBarbeiroAuth } from '../../hooks/useBarbeiroAuth';

export function BarbeiroLoginPage() {
  const navigate = useNavigate();
  const { login } = useBarbeiroAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await login(email, senha);
      navigate('/barbeiro/hoje');
    } catch (err: any) {
      setErro(err?.response?.data?.erro || 'Email ou senha incorretos.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw',
      fontFamily: "'Inter', -apple-system, sans-serif", overflow: 'hidden',
    }}>

      {/* PAINEL ESQUERDO — Formulário */}
      <div style={{
        flex: 1, background: '#0A0A0A', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px',
      }}>
        <div style={{ width: '100%', maxWidth: '360px' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '7px', background: '#F59E0B',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px', fontWeight: 700, color: '#0A0A0A',
            }}>G</div>
            <span style={{ fontSize: '16px', fontWeight: 600, color: '#F5F5F5', letterSpacing: '0.02em' }}>
              Garoa Sistema
            </span>
          </div>

          <h1 style={{ fontSize: '22px', fontWeight: 600, color: '#F5F5F5', margin: '0 0 4px' }}>
            Área do barbeiro
          </h1>
          <p style={{ fontSize: '13px', color: '#737373', margin: '0 0 32px' }}>
            Acesse sua agenda e comissões
          </p>

          {erro && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: '8px', padding: '10px 14px', marginBottom: '20px',
            }}>
              <AlertCircle size={14} color="#EF4444" />
              <span style={{ fontSize: '13px', color: '#EF4444' }}>{erro}</span>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 500, color: '#737373', display: 'block', marginBottom: '6px', letterSpacing: '0.02em' }}>
                Email
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={14} color="#525252" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com" required
                  style={{
                    width: '100%', background: '#1A1A1A', border: '1px solid #2A2A2A',
                    borderRadius: '8px', padding: '10px 14px 10px 36px', color: '#F5F5F5',
                    fontFamily: 'inherit', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '11px', fontWeight: 500, color: '#737373', display: 'block', marginBottom: '6px', letterSpacing: '0.02em' }}>
                Senha
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={14} color="#525252" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="password" value={senha} onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••" required
                  style={{
                    width: '100%', background: '#1A1A1A', border: '1px solid #2A2A2A',
                    borderRadius: '8px', padding: '10px 14px 10px 36px', color: '#F5F5F5',
                    fontFamily: 'inherit', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <button
              type="submit" disabled={carregando}
              style={{
                width: '100%', background: '#F59E0B', color: '#0A0A0A',
                fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
                padding: '12px', border: 'none', borderRadius: '8px',
                cursor: carregando ? 'not-allowed' : 'pointer',
                opacity: carregando ? 0.7 : 1, transition: 'opacity 0.15s',
              }}
            >
              {carregando ? 'Entrando...' : 'Entrar como barbeiro'}
            </button>
          </form>

          <button
            onClick={() => navigate('/')}
            style={{
              display: 'block', margin: '20px auto 0', background: 'none',
              border: 'none', cursor: 'pointer', fontSize: '12px',
              color: '#404040', fontFamily: 'inherit',
            }}
          >
            ← Voltar
          </button>
        </div>
      </div>

      {/* PAINEL DIREITO — Identidade barbeiro */}
      <div style={{
        width: '420px', flexShrink: 0, background: '#141414',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '48px', position: 'relative', overflow: 'hidden',
      }}>

        <svg style={{ position: 'absolute', inset: 0, opacity: 0.06 }} width="420" height="100%" viewBox="0 0 420 600" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="dots-b" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="#F59E0B"/>
            </pattern>
          </defs>
          <rect width="420" height="600" fill="url(#dots-b)"/>
        </svg>

        <div style={{ position: 'relative', zIndex: 2, marginBottom: '32px' }}>
          <svg width="140" height="140" viewBox="0 0 140 140">
            <style>{`
              @keyframes bt2 { 0%,100%{transform:rotate(-20deg)} 50%{transform:rotate(0deg)} }
              @keyframes bb2 { 0%,100%{transform:rotate(20deg)} 50%{transform:rotate(0deg)} }
              #bt2 { transform-origin:52px 70px; animation:bt2 1.4s ease-in-out infinite; }
              #bb2 { transform-origin:52px 70px; animation:bb2 1.4s ease-in-out infinite; }
            `}</style>
            <g id="bt2">
              <path d="M52 70 Q70 58 100 42 Q108 38 112 40 Q116 43 113 47 Q110 50 102 50 Q88 52 70 62 Z" fill="#F59E0B"/>
              <circle cx="52" cy="70" r="13" fill="none" stroke="#F59E0B" stroke-width="4"/>
              <circle cx="52" cy="70" r="5" fill="#F59E0B"/>
              <line x1="39" y1="62" x2="26" y2="54" stroke="#F59E0B" stroke-width="3.5" stroke-linecap="round"/>
              <line x1="39" y1="70" x2="24" y2="70" stroke="#F59E0B" stroke-width="3.5" stroke-linecap="round"/>
            </g>
            <g id="bb2">
              <path d="M52 70 Q70 82 100 98 Q108 102 112 100 Q116 97 113 93 Q110 90 102 90 Q88 88 70 78 Z" fill="#F59E0B"/>
              <circle cx="52" cy="70" r="13" fill="none" stroke="#F59E0B" stroke-width="4"/>
              <circle cx="52" cy="70" r="5" fill="#D97706"/>
              <line x1="39" y1="70" x2="24" y2="70" stroke="#F59E0B" stroke-width="3.5" stroke-linecap="round"/>
              <line x1="39" y1="78" x2="26" y2="86" stroke="#F59E0B" stroke-width="3.5" stroke-linecap="round"/>
            </g>
          </svg>
        </div>

        <h2 style={{
          fontSize: '28px', fontWeight: 700, color: '#F5F5F5',
          textAlign: 'center', lineHeight: 1.25, margin: '0 0 12px',
          position: 'relative', zIndex: 2, maxWidth: '280px',
        }}>
          Sua agenda. Suas comissões. Tudo no seu bolso.
        </h2>
        <p style={{
          fontSize: '13px', color: '#737373', textAlign: 'center',
          lineHeight: 1.6, margin: 0, position: 'relative', zIndex: 2, maxWidth: '240px',
        }}>
          Acompanhe seus atendimentos e ganhos em tempo real.
        </p>
      </div>
    </div>
  );
}
