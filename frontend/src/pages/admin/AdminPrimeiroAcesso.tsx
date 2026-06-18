import { useState, useEffect } from 'react';
import { User, Mail, Lock, AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';

export function AdminPrimeiroAcesso() {
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  async function handleRegistro(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const res = await api.post('/auth/register', { nome, email, senha, papel: 'ADMIN' });
      setSucesso(true);
      const token = res.data.token;
      setTimeout(() => navigate('/verificar-email', {
        state: {
          email,
          token,
          destino: '/admin/login',
        }
      }), 2000);
    } catch (error: any) {
      setErro(error?.response?.data?.erro || 'Erro ao criar administrador.');
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

      {/* PAINEL IDENTIDADE — topo no mobile, direita no desktop */}
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
        <svg style={{ position: 'absolute', inset: 0, opacity: 0.1 }} width="100%" height="100%" viewBox="0 0 420 600" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="dots-pa" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="#0A0A0A"/>
            </pattern>
          </defs>
          <rect width="420" height="600" fill="url(#dots-pa)"/>
        </svg>

        <div style={{ position: 'relative', zIndex: 2, marginBottom: isMobile ? '20px' : '32px' }}>
          <ScissorAnimation />
        </div>

        <h2 style={{
          fontSize: isMobile ? '22px' : '28px',
          fontWeight: 700, color: '#0A0A0A',
          textAlign: 'center', lineHeight: 1.25,
          margin: '0 0 12px', position: 'relative', zIndex: 2, maxWidth: '280px',
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

      {/* PAINEL FORMULÁRIO — baixo no mobile, esquerda no desktop */}
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
            Primeiro acesso
          </h1>
          <p style={{ fontSize: '13px', color: '#737373', margin: '0 0 32px' }}>
            Crie o usuário administrador inicial
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

          {sucesso && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: '8px', padding: '10px 14px', marginBottom: '20px',
            }}>
              <span style={{ fontSize: '13px', color: '#10B981' }}>
                Administrador criado! Redirecionando...
              </span>
            </div>
          )}

          <form onSubmit={handleRegistro}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 500, color: '#737373', display: 'block', marginBottom: '6px', letterSpacing: '0.02em' }}>
                Nome
              </label>
              <div style={{ position: 'relative' }}>
                <User size={14} color="#525252" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text" value={nome} onChange={e => setNome(e.target.value)}
                  placeholder="Nome do administrador" required
                  style={{
                    width: '100%', background: '#1A1A1A', border: '1px solid #2A2A2A',
                    borderRadius: '8px', padding: '10px 14px 10px 36px', color: '#F5F5F5',
                    fontFamily: 'inherit', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 500, color: '#737373', display: 'block', marginBottom: '6px', letterSpacing: '0.02em' }}>
                Email
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={14} color="#525252" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="admin@email.com" required
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
                  placeholder="••••••••" required minLength={6}
                  style={{
                    width: '100%', background: '#1A1A1A', border: '1px solid #2A2A2A',
                    borderRadius: '8px', padding: '10px 14px 10px 36px', color: '#F5F5F5',
                    fontFamily: 'inherit', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <button
              type="submit" disabled={carregando || sucesso}
              style={{
                width: '100%', background: '#F59E0B', color: '#0A0A0A',
                fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
                padding: '12px', border: 'none', borderRadius: '8px',
                cursor: (carregando || sucesso) ? 'not-allowed' : 'pointer',
                opacity: (carregando || sucesso) ? 0.7 : 1, transition: 'opacity 0.15s',
              }}
            >
              {carregando ? 'Criando...' : 'Criar administrador'}
            </button>
          </form>

          <button
            onClick={() => navigate('/admin/login')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              margin: '20px auto 0', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '12px', color: '#525252', fontFamily: 'inherit',
            }}
          >
            <ArrowLeft size={13} /> Voltar para o login
          </button>
        </div>
      </div>
    </div>
  );
}

function ScissorAnimation() {
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <style>{`
        @keyframes bladetop { 0%,100%{transform:rotate(-20deg)} 50%{transform:rotate(0deg)} }
        @keyframes bladebottom { 0%,100%{transform:rotate(20deg)} 50%{transform:rotate(0deg)} }
        #bt-pa { transform-origin:52px 70px; animation:bladetop 1.4s ease-in-out infinite; }
        #bb-pa { transform-origin:52px 70px; animation:bladebottom 1.4s ease-in-out infinite; }
      `}</style>
      <g id="bt-pa">
        <path d="M52 70 Q70 58 100 42 Q108 38 112 40 Q116 43 113 47 Q110 50 102 50 Q88 52 70 62 Z" fill="#0A0A0A"/>
        <circle cx="52" cy="70" r="13" fill="none" stroke="#0A0A0A" stroke-width="4"/>
        <circle cx="52" cy="70" r="5" fill="#0A0A0A"/>
        <line x1="39" y1="62" x2="26" y2="54" stroke="#0A0A0A" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="39" y1="70" x2="24" y2="70" stroke="#0A0A0A" stroke-width="3.5" stroke-linecap="round"/>
      </g>
      <g id="bb-pa">
        <path d="M52 70 Q70 82 100 98 Q108 102 112 100 Q116 97 113 93 Q110 90 102 90 Q88 88 70 78 Z" fill="#0A0A0A"/>
        <circle cx="52" cy="70" r="13" fill="none" stroke="#0A0A0A" stroke-width="4"/>
        <circle cx="52" cy="70" r="5" fill="#7C5A00"/>
        <line x1="39" y1="70" x2="24" y2="70" stroke="#0A0A0A" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="39" y1="78" x2="26" y2="86" stroke="#0A0A0A" stroke-width="3.5" stroke-linecap="round"/>
      </g>
    </svg>
  );
}
