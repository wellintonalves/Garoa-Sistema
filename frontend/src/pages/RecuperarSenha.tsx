import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import api from '../api/client';

type Etapa = 'email' | 'codigo' | 'nova-senha' | 'sucesso';

export function RecuperarSenha() {
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState<Etapa>('email');
  const [email, setEmail] = useState('');
  const [codigos, setCodigos] = useState(['', '', '', '', '', '']);
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [podeReenviar, setPodeReenviar] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (etapa === 'codigo' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setPodeReenviar(true);
    }
  }, [etapa, countdown]);

  async function handleSolicitarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await api.post('/recuperacao/solicitar', { email });
      setEtapa('codigo');
      setCountdown(60);
      setPodeReenviar(false);
    } catch (err: any) {
      setErro(err?.response?.data?.erro || 'Erro ao enviar código.');
    } finally {
      setCarregando(false);
    }
  }

  async function handleReenviar() {
    if (!podeReenviar) return;
    setErro('');
    try {
      await api.post('/recuperacao/solicitar', { email });
      setCountdown(60);
      setPodeReenviar(false);
    } catch (err: any) {
      setErro('Erro ao reenviar o código.');
    }
  }

  function handleCodigoInput(index: number, value: string, inputsRef: (HTMLInputElement | null)[]) {
    if (!/^\d*$/.test(value)) return;
    const novos = [...codigos];
    novos[index] = value.slice(-1);
    setCodigos(novos);
    if (value && index < 5) {
      inputsRef[index + 1]?.focus();
    }
  }

  function handleCodigoKeyDown(index: number, e: React.KeyboardEvent, inputsRef: (HTMLInputElement | null)[]) {
    if (e.key === 'Backspace' && !codigos[index] && index > 0) {
      inputsRef[index - 1]?.focus();
    }
  }

  function handleConfirmarCodigo() {
    const codigo = codigos.join('');
    if (codigo.length < 6) {
      setErro('Digite o código completo de 6 dígitos.');
      return;
    }
    setErro('');
    setEtapa('nova-senha');
  }

  async function handleRedefinirSenha(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não coincidem.');
      return;
    }
    if (novaSenha.length < 6) {
      setErro('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    setCarregando(true);
    try {
      await api.post('/recuperacao/redefinir', {
        email,
        codigo: codigos.join(''),
        novaSenha,
      });
      setEtapa('sucesso');
    } catch (err: any) {
      setErro(err?.response?.data?.erro || 'Erro ao redefinir senha.');
      setEtapa('codigo');
      setCodigos(['', '', '', '', '', '']);
    } finally {
      setCarregando(false);
    }
  }

  const titulos = {
    'email': 'Esqueci minha senha',
    'codigo': 'Digite o código',
    'nova-senha': 'Nova senha',
    'sucesso': 'Senha redefinida!',
  };

  const subtitulos = {
    'email': 'Informe seu email para receber o código de recuperação.',
    'codigo': `Enviamos um código para ${email}. Digite abaixo.`,
    'nova-senha': 'Defina sua nova senha abaixo.',
    'sucesso': 'Sua senha foi redefinida com sucesso.',
  };

  if (etapa === 'sucesso') {
    return (
      <div style={{
        height: '100vh', width: '100vw', background: '#0A0A0A',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}>
        <CheckCircle size={48} color="#10B981" strokeWidth={1.5} style={{ marginBottom: '16px' }} />
        <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#F5F5F5', margin: '0 0 8px' }}>
          Senha redefinida!
        </h2>
        <p style={{ fontSize: '13px', color: '#737373', margin: '0 0 24px' }}>
          Agora você já pode fazer login com a nova senha.
        </p>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: '#F59E0B', color: '#0A0A0A', border: 'none',
            borderRadius: '8px', padding: '10px 24px', fontSize: '13px',
            fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Ir para o login
        </button>
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
            <pattern id="dots-r" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="#0A0A0A"/>
            </pattern>
          </defs>
          <rect width="420" height="600" fill="url(#dots-r)"/>
        </svg>

        <div style={{ position: 'relative', zIndex: 2, marginBottom: isMobile ? '20px' : '32px' }}>
          <svg width="120" height="120" viewBox="0 0 120 120">
            <style>{`
              @keyframes lock-shake {
                0%,100% { transform: rotate(0deg); }
                20% { transform: rotate(-8deg); }
                40% { transform: rotate(8deg); }
                60% { transform: rotate(-4deg); }
                80% { transform: rotate(4deg); }
              }
              @keyframes lock-open {
                0%,60%,100% { transform: translateY(0); }
                80% { transform: translateY(-6px); }
              }
              #lock-body { animation: lock-shake 3s ease-in-out infinite; transform-origin: 60px 70px; }
              #lock-shackle { animation: lock-open 3s ease-in-out infinite; transform-origin: 60px 45px; }
            `}</style>
            <g id="lock-shackle">
              <path d="M42 55 L42 42 Q42 25 60 25 Q78 25 78 42 L78 55" fill="none" stroke="#0A0A0A" strokeWidth="5" strokeLinecap="round"/>
            </g>
            <g id="lock-body">
              <rect x="32" y="53" width="56" height="42" rx="6" fill="none" stroke="#0A0A0A" strokeWidth="4"/>
              <circle cx="60" cy="72" r="6" fill="#0A0A0A"/>
              <line x1="60" y1="78" x2="60" y2="86" stroke="#0A0A0A" strokeWidth="4" strokeLinecap="round"/>
            </g>
          </svg>
        </div>

        <h2 style={{
          fontSize: isMobile ? '20px' : '26px', fontWeight: 700, color: '#0A0A0A',
          textAlign: 'center', lineHeight: 1.25, margin: '0 0 10px',
          position: 'relative', zIndex: 2, maxWidth: '260px',
        }}>
          Recupere o acesso à sua conta.
        </h2>
        <p style={{
          fontSize: '13px', color: '#7C5A00', textAlign: 'center',
          lineHeight: 1.6, margin: 0, position: 'relative', zIndex: 2, maxWidth: '220px',
        }}>
          Em poucos passos você define uma nova senha.
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
            }}>V</div>
            <span style={{ letterSpacing: '0.02em', color: '#F5F5F5' }}>
              <strong style={{ fontSize: '18px', fontWeight: 700 }}>Valen</strong>
              <span style={{ fontSize: '13px', fontWeight: 400, color: '#737373' }}> Barber</span>
            </span>
          </div>

          <h1 style={{ fontSize: '22px', fontWeight: 600, color: '#F5F5F5', margin: '0 0 4px' }}>
            {titulos[etapa]}
          </h1>
          <p style={{ fontSize: '13px', color: '#737373', margin: '0 0 32px', lineHeight: 1.6 }}>
            {subtitulos[etapa]}
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

          {/* ETAPA 1 — Email */}
          {etapa === 'email' && (
            <form onSubmit={handleSolicitarCodigo}>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '11px', fontWeight: 500, color: '#737373', display: 'block', marginBottom: '6px' }}>
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
              <button type="submit" disabled={carregando} style={{
                width: '100%', background: '#F59E0B', color: '#0A0A0A',
                fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
                padding: '12px', border: 'none', borderRadius: '8px',
                cursor: carregando ? 'not-allowed' : 'pointer',
                opacity: carregando ? 0.7 : 1,
              }}>
                {carregando ? 'Enviando...' : 'Enviar código'}
              </button>
            </form>
          )}

          {/* ETAPA 2 — Código */}
          {etapa === 'codigo' && (
            <div>
              <CodigoInputs
                codigos={codigos}
                onChange={(i, v, refs) => handleCodigoInput(i, v, refs)}
                onKeyDown={(i, e, refs) => handleCodigoKeyDown(i, e, refs)}
              />
              <button onClick={handleConfirmarCodigo} style={{
                width: '100%', background: '#F59E0B', color: '#0A0A0A',
                fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
                padding: '12px', border: 'none', borderRadius: '8px',
                cursor: 'pointer', marginBottom: '16px',
              }}>
                Confirmar código
              </button>
              <div style={{ textAlign: 'center' }}>
                <button onClick={handleReenviar} disabled={!podeReenviar} style={{
                  background: 'none', border: 'none', cursor: podeReenviar ? 'pointer' : 'default',
                  fontSize: '12px', color: podeReenviar ? '#F59E0B' : '#525252',
                  fontFamily: 'inherit',
                }}>
                  {podeReenviar ? 'Reenviar código' : `Reenviar em ${countdown}s`}
                </button>
              </div>
            </div>
          )}

          {/* ETAPA 3 — Nova senha */}
          {etapa === 'nova-senha' && (
            <form onSubmit={handleRedefinirSenha}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', fontWeight: 500, color: '#737373', display: 'block', marginBottom: '6px' }}>
                  Nova senha
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={14} color="#525252" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres" required minLength={6}
                    style={{
                      width: '100%', background: '#1A1A1A', border: '1px solid #2A2A2A',
                      borderRadius: '8px', padding: '10px 14px 10px 36px', color: '#F5F5F5',
                      fontFamily: 'inherit', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '11px', fontWeight: 500, color: '#737373', display: 'block', marginBottom: '6px' }}>
                  Confirmar nova senha
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={14} color="#525252" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="password" value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)}
                    placeholder="Repita a nova senha" required
                    style={{
                      width: '100%', background: '#1A1A1A', border: '1px solid #2A2A2A',
                      borderRadius: '8px', padding: '10px 14px 10px 36px', color: '#F5F5F5',
                      fontFamily: 'inherit', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
              <button type="submit" disabled={carregando} style={{
                width: '100%', background: '#F59E0B', color: '#0A0A0A',
                fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
                padding: '12px', border: 'none', borderRadius: '8px',
                cursor: carregando ? 'not-allowed' : 'pointer',
                opacity: carregando ? 0.7 : 1,
              }}>
                {carregando ? 'Salvando...' : 'Redefinir senha'}
              </button>
            </form>
          )}

          <button
            onClick={() => navigate(-1)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              margin: '24px auto 0', background: 'none', border: 'none', cursor: 'pointer',
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

function CodigoInputs({ codigos, onChange, onKeyDown }: {
  codigos: string[];
  onChange: (i: number, v: string, refs: (HTMLInputElement | null)[]) => void;
  onKeyDown: (i: number, e: React.KeyboardEvent, refs: (HTMLInputElement | null)[]) => void;
}) {
  const refs: (HTMLInputElement | null)[] = [];

  return (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '28px', justifyContent: 'center' }}>
      {codigos.map((c, i) => (
        <input
          key={i}
          ref={el => { refs[i] = el; }}
          type="text" inputMode="numeric" maxLength={1} value={c}
          onChange={e => onChange(i, e.target.value, refs)}
          onKeyDown={e => onKeyDown(i, e, refs)}
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
  );
}
