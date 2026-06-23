import { useState, useEffect } from 'react';
import { Mail, Lock, AlertCircle, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import BarbeiroAnimation from '../../components/BarbeiroAnimation';

export function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
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
      const res = await api.post('/auth/login', { email, senha, papel: 'ADMIN' });
      localStorage.setItem('@garoa:token', res.data.token);
      localStorage.setItem('@garoa:usuario', JSON.stringify(res.data.usuario));
      navigate('/admin');
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
      minHeight: '100vh',
      width: '100vw',
      fontFamily: "'Inter', -apple-system, sans-serif",
      overflow: isMobile ? 'auto' : 'hidden',
    }}>

      {/* PAINEL ESQUERDO — Formulário */}
      <div style={{
        flex: 1,
        background: '#0A0A0A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? '40px 24px' : '48px',
        order: isMobile ? 1 : 0,
      }}>
        <div style={{ width: '100%', maxWidth: '360px' }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '7px',
              background: '#F59E0B', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: '#0A0A0A',
            }}>G</div>
            <span style={{ fontSize: '16px', fontWeight: 600, color: '#F5F5F5', letterSpacing: '0.02em' }}>
              Garoa Sistema
            </span>
          </div>

          <h1 style={{ fontSize: '22px', fontWeight: 600, color: '#F5F5F5', margin: '0 0 4px' }}>
            Bem-vindo de volta
          </h1>
          <p style={{ fontSize: '13px', color: '#737373', margin: '0 0 32px' }}>
            Acesse o painel administrativo
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
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
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
                  type="password"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%', background: '#1A1A1A', border: '1px solid #2A2A2A',
                    borderRadius: '8px', padding: '10px 14px 10px 36px', color: '#F5F5F5',
                    fontFamily: 'inherit', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ textAlign: 'right', marginBottom: '24px', marginTop: '-8px' }}>
              <button
                type="button"
                onClick={() => navigate('/recuperar-senha')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '12px', color: '#737373', fontFamily: 'inherit',
                }}
              >
                Esqueci minha senha
              </button>
            </div>

            <button
              type="submit"
              disabled={carregando}
              style={{
                width: '100%', background: '#F59E0B', color: '#0A0A0A',
                fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
                padding: '12px', border: 'none', borderRadius: '8px',
                cursor: carregando ? 'not-allowed' : 'pointer',
                opacity: carregando ? 0.7 : 1, transition: 'opacity 0.15s',
              }}
            >
              {carregando ? 'Entrando...' : 'Entrar como administrador'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '20px' }}>
            <UserPlus size={13} color="#525252" />
            <button
              onClick={() => navigate('/admin/primeiro-acesso')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '12px', color: '#525252', fontFamily: 'inherit',
              }}
            >
              Primeiro acesso
            </button>
          </div>

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
              onClick={() => navigate('/barbeiro/login')}
              style={{
                background: 'none', border: '1px solid #2A2A2A', borderRadius: '6px',
                cursor: 'pointer', fontSize: '12px', color: '#737373',
                fontFamily: 'inherit', padding: '6px 14px',
              }}
            >
              Área do barbeiro
            </button>
          </div>

          <button
            onClick={() => navigate('/')}
            style={{
              display: 'block', margin: '12px auto 0', background: 'none',
              border: 'none', cursor: 'pointer', fontSize: '12px',
              color: '#404040', fontFamily: 'inherit',
            }}
          >
            ← Voltar
          </button>
        </div>
      </div>

      {/* PAINEL DIREITO — Identidade visual */}
      <div style={{
        width: isMobile ? '100%' : '420px',
        height: isMobile ? 'auto' : '100vh',
        flexShrink: 0,
        background: '#F59E0B',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? '40px 32px' : '48px',
        position: 'relative',
        overflow: 'hidden',
        order: isMobile ? 0 : 1,
      }}>

        {/* Padrão de pontos decorativo */}
        <svg style={{ position: 'absolute', inset: 0, opacity: 0.1 }} width="420" height="100%" viewBox="0 0 420 600" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="#0A0A0A"/>
            </pattern>
          </defs>
          <rect width="420" height="600" fill="url(#dots)"/>
        </svg>

        {/* Animação do Barbeiro */}
        <div style={{ position: 'relative', zIndex: 2, marginBottom: '32px' }}>
          <BarbeiroAnimation />
        </div>

        <h2 style={{
          fontSize: isMobile ? '22px' : '28px', fontWeight: 700, color: '#0A0A0A',
          textAlign: 'center', lineHeight: 1.25, margin: '0 0 12px',
          position: 'relative', zIndex: 2, maxWidth: '280px',
        }}>
          Feito para quem aceita apenas o melhor.
        </h2>
        <p style={{
          fontSize: '13px', color: '#7C5A00', textAlign: 'center',
          lineHeight: 1.6, margin: 0, position: 'relative', zIndex: 2, maxWidth: '240px',
        }}>
          O sistema completo que faz sua barbearia crescer de verdade.
        </p>
      </div>
    </div>
  );
}

