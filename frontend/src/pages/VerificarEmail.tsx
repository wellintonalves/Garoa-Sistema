import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Envelope, ArrowsClockwise, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import api from '../api/client';
import { Botao } from '../components/ui';

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
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const email = location.state?.email || '';
  const token = location.state?.token || '';
  const usuarioId = location.state?.usuarioId || '';
  const nome = location.state?.nome || '';

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
      setTimeout(() => navigate('/', { state: { mensagemSucesso: 'Email verificado com sucesso! Faça login para continuar.', destino: location.state?.destino } }), 2000);
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
      await api.post('/verificacao/reenviar', { usuarioId, email: email.trim(), nome: nome.trim() });
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
        minHeight: '100dvh', width: '100vw', background: 'var(--fundo-pagina)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--espaco-4)', boxSizing: 'border-box', overflowY: 'auto',
      }}>
        <div style={{
          width: '100%', maxWidth: '420px', background: 'var(--fundo-superficie)',
          borderRadius: 'var(--raio-xl)', padding: 'var(--espaco-6)',
          border: '1px solid var(--borda-sutil)', boxShadow: 'var(--elevacao-2)',
          boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <CheckCircle size={48} weight="regular" color="var(--sucesso)" style={{ marginBottom: 'var(--espaco-4)' }} aria-hidden="true" />
          <h1 style={{
            fontFamily: 'var(--fonte-serif)', fontSize: 'var(--texto-h1, 1.75rem)',
            fontWeight: 400, color: 'var(--texto-principal)', margin: '0 0 var(--espaco-2)', textAlign: 'center',
          }}>
            Email verificado!
          </h1>
          <p style={{ color: 'var(--texto-secundario)', fontSize: 'var(--texto-sm, 0.75rem)', margin: 0, textAlign: 'center' }}>
            Redirecionando...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100dvh',
      width: '100vw',
      background: 'var(--fundo-pagina)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--espaco-4)',
      boxSizing: 'border-box',
      overflowY: 'auto'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'var(--fundo-superficie)',
        borderRadius: 'var(--raio-xl)',
        padding: 'var(--espaco-6)',
        border: '1px solid var(--borda-sutil)',
        boxShadow: 'var(--elevacao-2)',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espaco-2)', marginBottom: 'var(--espaco-4)' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: 'var(--raio-md)', background: 'var(--cor-primaria)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 'var(--texto-body, 0.875rem)', fontWeight: 700, color: 'var(--texto-sobre-primaria)', flexShrink: 0,
          }}>V</div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <strong style={{ fontSize: 'var(--texto-h3, 1.25rem)', fontWeight: 700, color: 'var(--texto-principal)' }}>Valen</strong>
            <span style={{ fontSize: 'var(--texto-detalhe, 0.75rem)', fontWeight: 400, color: 'var(--texto-secundario)', letterSpacing: '0.08em' }}>BARBER</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espaco-2)', marginBottom: 'var(--espaco-1)' }}>
          <Envelope size={20} weight="regular" style={{ color: 'var(--cor-primaria)' }} aria-hidden="true" />
          <h1 style={{
            fontFamily: 'var(--fonte-serif)',
            fontSize: 'var(--texto-h1, 1.75rem)',
            fontWeight: 400,
            color: 'var(--texto-principal)',
            margin: 0,
            textAlign: 'center'
          }}>
            Verifique seu email
          </h1>
        </div>
        <p style={{ color: 'var(--texto-secundario)', fontSize: 'var(--texto-sm, 0.75rem)', margin: '0 0 var(--espaco-4)', textAlign: 'center', lineHeight: 1.6 }}>
          Enviamos um código para <strong style={{ color: 'var(--texto-principal)' }}>{email}</strong>. Digite abaixo para confirmar.
        </p>

        {/* Reserva de altura para alerta/erro */}
        <div style={{ width: '100%', minHeight: '44px', marginBottom: 'var(--espaco-3)', display: 'flex', alignItems: 'center' }}>
          {erro ? (
            <div style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--espaco-2)',
              background: 'var(--erro-fundo)', border: '1px solid var(--erro)',
              borderRadius: 'var(--raio-md)', padding: 'var(--espaco-2) var(--espaco-3)',
              color: 'var(--erro)', fontSize: 'var(--texto-sm, 0.75rem)',
            }} role="alert">
              <WarningCircle size={18} weight="regular" style={{ flexShrink: 0 }} aria-hidden="true" />
              <span>{erro}</span>
            </div>
          ) : null}
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--espaco-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--espaco-2)', justifyContent: 'center' }} onPaste={handlePaste}>
            {codigos.map((c, i) => (
              <input
                key={i}
                ref={el => { inputs.current[i] = el; }}
                type="text" inputMode="numeric" maxLength={1} value={c}
                onChange={e => handleInput(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                style={{
                  width: '48px', height: '56px', textAlign: 'center',
                  background: 'var(--fundo-superficie-2)',
                  border: `1px solid ${c ? 'var(--cor-primaria)' : 'var(--borda-sutil)'}`,
                  borderRadius: 'var(--raio-md)', color: 'var(--texto-principal)',
                  fontFamily: "var(--fonte-mono, 'JetBrains Mono', monospace)",
                  fontSize: 'var(--texto-h2, 1.5rem)', fontWeight: 500, outline: 'none',
                  transition: 'border-color 0.15s', boxSizing: 'border-box',
                }}
              />
            ))}
          </div>

          <Botao type="button" variante="primario" onClick={handleConfirmar} loading={carregando} style={{ width: '100%' }}>
            Confirmar código
          </Botao>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--espaco-1)' }}>
            <ArrowsClockwise size={18} weight="regular" style={{ color: 'var(--texto-secundario)' }} aria-hidden="true" />
            <button
              type="button"
              onClick={handleReenviar}
              disabled={!podeReenviar || reenviando}
              style={{
                background: 'none', border: 'none', cursor: podeReenviar ? 'pointer' : 'default',
                fontSize: 'var(--texto-sm, 0.75rem)', color: podeReenviar ? 'var(--cor-primaria)' : 'var(--texto-secundario)',
                textDecoration: podeReenviar ? 'underline' : 'none', minHeight: '44px',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 var(--espaco-2)'
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
