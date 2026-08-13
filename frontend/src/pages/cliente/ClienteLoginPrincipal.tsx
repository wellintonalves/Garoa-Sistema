import { useState } from 'react';
import { Envelope, Lock, WarningCircle, Eye, EyeSlash } from '@phosphor-icons/react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import Lottie from 'lottie-react';
import premiumAnimation from '../../assets/animations/premium.json';
import { useClienteAuth } from '../../hooks/useClienteAuth';
import { Input, Botao } from '../../components/ui';

export function ClienteLoginPrincipal() {
  const navigate = useNavigate();
  const location = useLocation();
  const mensagemSucesso = location.state?.mensagemSucesso;
  const { login } = useClienteAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [searchParams] = useSearchParams();
  const expirado = searchParams.get('exp') === '1';
  const [erro, setErro] = useState(expirado ? 'Sua sessão expirou. Entre novamente para continuar.' : '');
  const [carregando, setCarregando] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await login(email.trim(), senha);
      navigate(location.state?.destino || '/cliente/home');
    } catch (err: any) {
      setErro(err?.response?.data?.erro || err.message || 'Email ou senha incorretos.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main style={{
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

        <div style={{ width: '120px', height: '120px', marginBottom: 'var(--espaco-2)' }}>
          <Lottie
            animationData={premiumAnimation}
            loop={true}
            autoplay={true}
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        <h1 style={{
          fontFamily: 'var(--fonte-serif)',
          fontSize: 'var(--texto-h1, 1.75rem)',
          fontWeight: 400,
          color: 'var(--texto-principal)',
          margin: '0 0 var(--espaco-1)',
          textAlign: 'center'
        }}>
          Olá, cliente
        </h1>
        <p style={{ color: 'var(--texto-secundario)', fontSize: 'var(--texto-sm, 0.75rem)', margin: '0 0 var(--espaco-4)', textAlign: 'center' }}>
          Acesse sua conta para agendar
        </p>

        {/* Reserva de altura para alerta/erro */}
        <div style={{ width: '100%', minHeight: '44px', marginBottom: 'var(--espaco-3)', display: 'flex', alignItems: 'center' }}>
          {mensagemSucesso ? (
            <div style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--espaco-2)',
              background: 'var(--sucesso-fundo)', border: '1px solid var(--sucesso)',
              borderRadius: 'var(--raio-md)', padding: 'var(--espaco-2) var(--espaco-3)',
              color: 'var(--sucesso)', fontSize: 'var(--texto-sm, 0.75rem)',
            }} role="alert">
              <WarningCircle size={18} weight="regular" style={{ flexShrink: 0 }} aria-hidden="true" />
              <span>{mensagemSucesso}</span>
            </div>
          ) : erro ? (
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

        <form onSubmit={handleLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--espaco-4)' }}>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value.trim().toLowerCase())}
            placeholder="seu@email.com"
            required
            iconeEsquerda={<Envelope size={18} weight="regular" aria-hidden="true" />}
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="email"
          />

          <Input
            label="Senha"
            type={mostrarSenha ? "text" : "password"}
            value={senha}
            onChange={e => setSenha(e.target.value)}
            placeholder="••••••••"
            required
            iconeEsquerda={<Lock size={18} weight="regular" aria-hidden="true" />}
            iconeDireita={
              <button
                type="button"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-secundario)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', padding: 0 }}
              >
                {mostrarSenha ? <EyeSlash size={18} weight="regular" aria-hidden="true" /> : <Eye size={18} weight="regular" aria-hidden="true" />}
              </button>
            }
          />

          <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <button
              type="button"
              onClick={() => navigate('/recuperar-senha')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--texto-secundario)', fontSize: 'var(--texto-sm, 0.75rem)',
                textDecoration: 'underline', minHeight: '44px', display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center', padding: '0 var(--espaco-2)'
              }}
            >
              Esqueci minha senha
            </button>
          </div>

          <Botao
            type="submit"
            variante="primario"
            loading={carregando}
            style={{ width: '100%' }}
          >
            Entrar
          </Botao>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 'var(--espaco-4)' }}>
          <button
            type="button"
            onClick={() => navigate('/cadastro')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--texto-secundario)', fontSize: 'var(--texto-sm, 0.75rem)',
              textDecoration: 'underline', minHeight: '44px', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', padding: '0 var(--espaco-2)'
            }}
          >
            Criar conta grátis
          </button>
        </div>

        <div style={{
          width: '100%',
          borderTop: '1px solid var(--borda-sutil)',
          marginTop: 'var(--espaco-6)',
          paddingTop: 'var(--espaco-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--espaco-3)',
          alignItems: 'center',
        }}>
          <p style={{ fontSize: 'var(--texto-detalhe, 0.75rem)', color: 'var(--texto-secundario)', margin: 0 }}>
            Acesso para profissionais
          </p>
          <div style={{ display: 'flex', gap: 'var(--espaco-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => navigate('/barbeiro/login')}
              style={{
                background: 'var(--fundo-superficie-2)', border: '1px solid var(--borda-sutil)', borderRadius: 'var(--raio-md)',
                cursor: 'pointer', fontSize: 'var(--texto-sm, 0.75rem)', color: 'var(--texto-secundario)',
                minHeight: '44px', padding: '0 var(--espaco-4)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
              }}
            >
              Sou barbeiro
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/login')}
              style={{
                background: 'var(--fundo-superficie-2)', border: '1px solid var(--borda-sutil)', borderRadius: 'var(--raio-md)',
                cursor: 'pointer', fontSize: 'var(--texto-sm, 0.75rem)', color: 'var(--texto-secundario)',
                minHeight: '44px', padding: '0 var(--espaco-4)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
              }}
            >
              Painel administrativo
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
