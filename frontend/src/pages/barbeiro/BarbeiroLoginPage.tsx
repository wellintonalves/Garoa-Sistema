import { useState, useEffect } from 'react';
import { Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Lottie from 'lottie-react';
import mustacheAnimation from '../../assets/animations/mustache-amber.json';
import { useBarbeiroAuth } from '../../hooks/useBarbeiroAuth';

export function BarbeiroLoginPage() {
  const navigate = useNavigate();
  const { login } = useBarbeiroAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      minHeight: '100vh', width: '100vw',
      fontFamily: "'Inter', -apple-system, sans-serif",
      overflow: isMobile ? 'auto' : 'hidden',
    }}>

      {/* PAINEL ESQUERDO — Formulário */}
      <div style={{
        flex: 1, background: '#0A0A0A', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '40px 24px' : '48px',
        order: isMobile ? 1 : 0,
      }}>
        <div style={{ width: '100%', maxWidth: '360px' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '7px', background: '#F59E0B',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px', fontWeight: 700, color: '#0A0A0A', flexShrink: 0,
            }}>V</div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <strong style={{ fontSize: '18px', fontWeight: 700, color: '#F5F5F5' }}>Valen</strong>
              <span style={{ fontSize: '11px', fontWeight: 400, color: '#737373', letterSpacing: '0.08em' }}>BARBER</span>
            </div>
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
                  type={mostrarSenha ? "text" : "password"} value={senha} onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••" required
                  style={{
                    width: '100%', background: '#1A1A1A', border: '1px solid #2A2A2A',
                    borderRadius: '8px', padding: '10px 14px 10px 36px', paddingRight: '36px', color: '#F5F5F5',
                    fontFamily: 'inherit', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                  }}
                />
                    <button
                      type="button"
                      onClick={() => setMostrarSenha(!mostrarSenha)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#525252', padding: 0 }}
                    >
                      {mostrarSenha ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
                    </button>
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

          <div style={{
            borderTop: '1px solid #1F1F1F',
            marginTop: '24px',
            paddingTop: '16px',
            display: 'flex',
            justifyContent: 'center',
            gap: '16px',
          }}>
            <button
              onClick={() => navigate('/')}
              style={{
                background: 'none', border: '1px solid #2A2A2A', borderRadius: '6px',
                cursor: 'pointer', fontSize: '12px', color: '#737373',
                fontFamily: 'inherit', padding: '6px 14px',
              }}
            >
              Área do cliente
            </button>
            <button
              onClick={() => navigate('/admin/login')}
              style={{
                background: 'none', border: '1px solid #2A2A2A', borderRadius: '6px',
                cursor: 'pointer', fontSize: '12px', color: '#737373',
                fontFamily: 'inherit', padding: '6px 14px',
              }}
            >
              Painel administrativo
            </button>
          </div>
        </div>
      </div>

      {/* PAINEL DIREITO — Identidade barbeiro */}
      <div style={{
        width: isMobile ? '100%' : '420px',
        height: isMobile ? 'auto' : '100vh',
        flexShrink: 0, background: '#141414',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: isMobile ? '40px 32px' : '48px',
        position: 'relative', overflow: 'hidden',
        order: isMobile ? 0 : 1,
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
          <Lottie
            animationData={mustacheAnimation}
            loop={true}
            autoplay={true}
            style={{ width: '180px', height: '180px' }}
          />
        </div>

        <h2 style={{
          fontSize: isMobile ? '22px' : '28px', fontWeight: 700, color: '#F5F5F5',
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
