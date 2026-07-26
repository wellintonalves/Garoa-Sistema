import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle, CheckCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import api from '../api/client';
import { Input, Botao } from '../components/ui';

type Etapa = 'email' | 'codigo' | 'nova-senha' | 'sucesso';

export function RecuperarSenha() {
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState<Etapa>('email');
  const [email, setEmail] = useState('');
  const [codigos, setCodigos] = useState(['', '', '', '', '', '']);
  const [novaSenha, setNovaSenha] = useState('');
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [podeReenviar, setPodeReenviar] = useState(false);

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
      await api.post('/recuperacao/solicitar', { email: email.trim() });
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
      await api.post('/recuperacao/solicitar', { email: email.trim() });
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
        email: email.trim(),
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
          <CheckCircle size={48} color="var(--sucesso)" strokeWidth={1.5} style={{ marginBottom: 'var(--espaco-4)' }} />
          <h1 style={{
            fontFamily: 'var(--fonte-serif)', fontSize: 'var(--texto-h1, 1.75rem)',
            fontWeight: 400, color: 'var(--texto-principal)', margin: '0 0 var(--espaco-2)', textAlign: 'center',
          }}>
            {titulos[etapa]}
          </h1>
          <p style={{ color: 'var(--texto-secundario)', fontSize: 'var(--texto-sm, 0.75rem)', margin: '0 0 var(--espaco-6)', textAlign: 'center', lineHeight: 1.6 }}>
            {subtitulos[etapa]}
          </p>
          <Botao
            type="button"
            variante="primario"
            onClick={() => navigate('/login')}
            style={{ width: '100%' }}
          >
            Ir para o login
          </Botao>
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
        {/* Logo / Animação */}
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

        <h1 style={{
          fontFamily: 'var(--fonte-serif)',
          fontSize: 'var(--texto-h1, 1.75rem)',
          fontWeight: 400,
          color: 'var(--texto-principal)',
          margin: '0 0 var(--espaco-1)',
          textAlign: 'center'
        }}>
          {titulos[etapa]}
        </h1>
        <p style={{ color: 'var(--texto-secundario)', fontSize: 'var(--texto-sm, 0.75rem)', margin: '0 0 var(--espaco-4)', textAlign: 'center', lineHeight: 1.6 }}>
          {subtitulos[etapa]}
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
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{erro}</span>
            </div>
          ) : null}
        </div>

        {/* ETAPA 1 — Email */}
        {etapa === 'email' && (
          <form onSubmit={handleSolicitarCodigo} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--espaco-4)' }}>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              iconeEsquerda={<Mail size={16} />}
            />
            <Botao type="submit" variante="primario" loading={carregando} style={{ width: '100%' }}>
              Enviar código
            </Botao>
          </form>
        )}

        {/* ETAPA 2 — Código */}
        {etapa === 'codigo' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--espaco-4)' }}>
            <CodigoInputs
              codigos={codigos}
              onChange={(i, v, refs) => handleCodigoInput(i, v, refs)}
              onKeyDown={(i, e, refs) => handleCodigoKeyDown(i, e, refs)}
            />
            <Botao type="button" variante="primario" onClick={handleConfirmarCodigo} style={{ width: '100%' }}>
              Confirmar código
            </Botao>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handleReenviar}
                disabled={!podeReenviar}
                style={{
                  background: 'none', border: 'none', cursor: podeReenviar ? 'pointer' : 'default',
                  fontSize: 'var(--texto-sm, 0.75rem)', color: podeReenviar ? 'var(--cor-primaria)' : 'var(--texto-terciario)',
                  textDecoration: podeReenviar ? 'underline' : 'none', minHeight: '44px',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 var(--espaco-2)'
                }}
              >
                {podeReenviar ? 'Reenviar código' : `Reenviar em ${countdown}s`}
              </button>
            </div>
          </div>
        )}

        {/* ETAPA 3 — Nova senha */}
        {etapa === 'nova-senha' && (
          <form onSubmit={handleRedefinirSenha} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--espaco-4)' }}>
            <Input
              label="Nova senha"
              type={mostrarNovaSenha ? "text" : "password"}
              value={novaSenha}
              onChange={e => setNovaSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
              iconeEsquerda={<Lock size={16} />}
              iconeDireita={
                <button
                  type="button"
                  onClick={() => setMostrarNovaSenha(!mostrarNovaSenha)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-terciario)', display: 'flex', alignItems: 'center', padding: 0 }}
                >
                  {mostrarNovaSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />

            <Input
              label="Confirmar nova senha"
              type={mostrarConfirmarSenha ? "text" : "password"}
              value={confirmarSenha}
              onChange={e => setConfirmarSenha(e.target.value)}
              placeholder="Repita a nova senha"
              required
              iconeEsquerda={<Lock size={16} />}
              iconeDireita={
                <button
                  type="button"
                  onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-terciario)', display: 'flex', alignItems: 'center', padding: 0 }}
                >
                  {mostrarConfirmarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />

            <Botao type="submit" variante="primario" loading={carregando} style={{ width: '100%' }}>
              Redefinir senha
            </Botao>
          </form>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 'var(--espaco-4)' }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--texto-secundario)', fontSize: 'var(--texto-sm, 0.75rem)',
              textDecoration: 'underline', minHeight: '44px', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', gap: 'var(--espaco-1)', padding: '0 var(--espaco-2)'
            }}
          >
            <ArrowLeft size={14} /> Voltar para o login
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
    <div style={{ display: 'flex', gap: 'var(--espaco-2)', marginBottom: 'var(--espaco-2)', justifyContent: 'center' }}>
      {codigos.map((c, i) => (
        <input
          key={i}
          ref={el => { refs[i] = el; }}
          type="text" inputMode="numeric" maxLength={1} value={c}
          onChange={e => onChange(i, e.target.value, refs)}
          onKeyDown={e => onKeyDown(i, e, refs)}
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
  );
}
