import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, RefreshCw, CheckCircle } from 'lucide-react';
import api from '../api/client';

export function VerificarEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const [codigos, setCodigos] = useState(['', '', '', '', '', '']);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [podeReenviar, setPodeReenviar] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const email = location.state?.email || '';
  const token = location.state?.token || '';
  const destino = location.state?.destino || '/';
  const usuarioId = location.state?.usuarioId || '';
  const nome = location.state?.nome || '';

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (token) {
      localStorage.setItem('@garoa:token', token);
    }
  }, [token]);

  useEffect(() => {
    if (countdown > 0 && !podeReenviar) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setPodeReenviar(true);
    }
  }, [countdown, podeReenviar]);

  function handleInput(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const novos = [...codigos];
    novos[index] = value.slice(-1);
    setCodigos(novos);
    if (value && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !codigos[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const texto = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const novos = [...codigos];
    texto.split('').forEach((c, i) => { novos[i] = c; });
    setCodigos(novos);
    inputs.current[Math.min(texto.length, 5)]?.focus();
  }

  async function handleConfirmar() {
    const codigo = codigos.join('');
    if (codigo.length < 6) {
      setErro('Digite o código completo de 6 dígitos.');
      return;
    }
    setErro('');
    setCarregando(true);
    try {
      await api.post('/verificacao/confirmar', { usuarioId, codigo });
      setSucesso(true);
      setTimeout(() => navigate(destino), 2000);
    } catch (err: any) {
      setErro(err?.response?.data?.erro || 'Código inválido ou expirado.');
      setCodigos(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setCarregando(false);
    }
  }

  async function handleReenviar() {
    if (!podeReenviar) return;
    setReenviando(true);
    setErro('');
    try {
      await api.post('/verificacao/reenviar', { usuarioId, email, nome });
      setPodeReenviar(false);
      setCountdown(60);
    } catch (err: any) {
      setErro('Erro ao reenviar o código. Tente novamente.');
    } finally {
      setReenviando(false);
    }
  }

  if (sucesso) {
    return (
      <div style={{
        height: '100vh', width: '100vw', background: '#0A0A0A',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}>
        <CheckCircle size={48} color="#10B981" strokeWidth={1.5} style={{ marginBottom: '16px' }} />
        <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#F5F5F5', margin: '0 0 8px' }}>
          Email verificado!
        </h2>
        <p style={{ fontSize: '13px', color: '#737373', margin: 0 }}>
          Redirecionando...
        </p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: isMobile ? 'column' : 'row',
      minHeight: '100vh', width: '100vw',
      fontFamily: "'Inter', -apple-system, sans-serif",
      overflow: isMobile ? 'auto' : 'hidden',
    }}>

      {/* PAINEL IDENTIDADE */}
      <div style={{
        width: isMobile ? '100%' : '420px',
        height: isMobile ? 'auto' : '100vh',
        flexShrink: 0, background: '#F59E0B',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '40px 32px' : '48px',
        position: 'relative', overflow: 'hidden',
        order: isMobile ? 0 : 1,
      }}>
        <svg style={{ position: 'absolute', inset: 0, opacity: 0.1 }} width="100%" height="100%" viewBox="0 0 420 600" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="dots-v" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="#0A0A0A"/>
            </pattern>
          </defs>
          <rect width="420" height="600" fill="url(#dots-v)"/>
        </svg>

        <div style={{ position: 'relative', zIndex: 2, marginBottom: isMobile ? '20px' : '32px' }}>
          <svg width="120" height="120" viewBox="0 0 120 120">
            <style>{`
              @keyframes mail-pulse {
                0%,100% { transform: scale(1); }
                50% { transform: scale(1.06); }
              }
              @keyframes dot-blink {
                0%,100% { opacity: 1; }
                50% { opacity: 0.2; }
              }
              #mail-g { animation: mail-pulse 2s ease-in-out infinite; transform-origin: 60px 60px; }
              #dot1 { animation: dot-blink 1.2s ease-in-out infinite; }
              #dot2 { animation: dot-blink 1.2s ease-in-out infinite 0.4s; }
              #dot3 { animation: dot-blink 1.2s ease-in-out infinite 0.8s; }
            `}</style>
            <g id="mail-g">
              <rect x="20" y="35" width="80" height="55" rx="4" fill="none" stroke="#0A0A0A" strokeWidth="3"/>
              <path d="M20 40 L60 65 L100 40" fill="none" stroke="#0A0A0A" strokeWidth="3" strokeLinecap="round"/>
            </g>
            <circle id="dot1" cx="44" cy="95" r="3" fill="#0A0A0A"/>
            <circle id="dot2" cx="60" cy="95" r="3" fill="#0A0A0A"/>
            <circle id="dot3" cx="76" cy="95" r="3" fill="#0A0A0A"/>
          </svg>
        </div>

        <h2 style={{
          fontSize: isMobile ? '20px' : '26px', fontWeight: 700, color: '#0A0A0A',
          textAlign: 'center', lineHeight: 1.25, margin: '0 0 10px',
          position: 'relative', zIndex: 2, maxWidth: '260px',
        }}>
          Confirme seu email para continuar.
        </h2>
        <p style={{
          fontSize: '13px', color: '#7C5A00', textAlign: 'center',
          lineHeight: 1.6, margin: 0, position: 'relative', zIndex: 2, maxWidth: '220px',
        }}>
          Enviamos um código de 6 dígitos para o seu email.
        </p>
      </div>

      {/* PAINEL FORMULÁRIO */}
      <div style={{
        flex: 1, background: '#0A0A0A',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <Mail size={18} color="#F59E0B" strokeWidth={1.5} />
            <h1 style={{ fontSize: '22px', fontWeight: 600, color: '#F5F5F5', margin: 0 }}>
              Verifique seu email
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: '#737373', margin: '0 0 32px', lineHeight: 1.6 }}>
            Enviamos um código para <strong style={{ color: '#F5F5F5' }}>{email}</strong>. Digite abaixo para confirmar.
          </p>

          {erro && (
            <div style={{
              background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: '8px', padding: '10px 14px', marginBottom: '20px',
            }}>
              <span style={{ fontSize: '13px', color: '#EF4444' }}>{erro}</span>
            </div>
          )}

          {/* Inputs do código */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '28px', justifyContent: 'center' }} onPaste={handlePaste}>
            {codigos.map((c, i) => (
              <input
                key={i}
                ref={el => { inputs.current[i] = el; }}
                type="text" inputMode="numeric" maxLength={1} value={c}
                onChange={e => handleInput(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                style={{
                  width: '48px', height: '56px', textAlign: 'center',
                  background: '#1A1A1A', border: `1px solid ${c ? '#F59E0B' : '#2A2A2A'}`,
                  borderRadius: '8px', color: '#F5F5F5',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '24px', fontWeight: 500, outline: 'none',
                  transition: 'border-color 0.15s',
                }}
              />
            ))}
          </div>

          <button
            onClick={handleConfirmar} disabled={carregando}
            style={{
              width: '100%', background: '#F59E0B', color: '#0A0A0A',
              fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
              padding: '12px', border: 'none', borderRadius: '8px',
              cursor: carregando ? 'not-allowed' : 'pointer',
              opacity: carregando ? 0.7 : 1, transition: 'opacity 0.15s',
              marginBottom: '16px',
            }}
          >
            {carregando ? 'Verificando...' : 'Confirmar código'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <RefreshCw size={12} color="#525252" />
            <button
              onClick={handleReenviar} disabled={!podeReenviar || reenviando}
              style={{
                background: 'none', border: 'none', cursor: podeReenviar ? 'pointer' : 'default',
                fontSize: '12px', color: podeReenviar ? '#F59E0B' : '#525252',
                fontFamily: 'inherit', transition: 'color 0.15s',
              }}
            >
              {reenviando ? 'Reenviando...' : podeReenviar ? 'Reenviar código' : `Reenviar em ${countdown}s`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
