// Tela de cadastro do cliente — /cadastro
// Visual premium mobile-first para o cliente
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClienteAuth } from '../../hooks/useClienteAuth';
import { User, Phone, Envelope, Lock, WarningCircle, Scissors, ArrowLeft, Eye, EyeSlash, Gift } from '@phosphor-icons/react';

export function ClienteCadastro() {
  const navigate = useNavigate();
  const { registrar } = useClienteAuth();
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [codigoIndicacao, setCodigoIndicacao] = useState(() => localStorage.getItem('valen_invite_code') || '');

  const nomeBarbearia = import.meta.env.VITE_BARBEARIA_NOME || 'GAROA';

  // Máscara para telefone
  function formatarTelefone(valor: string) {
    const numeros = valor.replace(/\D/g, '');
    if (numeros.length <= 2) return `(${numeros}`;
    if (numeros.length <= 7) return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7, 11)}`;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');

    if (senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setEnviando(true);
    try {
      const { usuarioId } = await registrar(nome, email, senha, telefone);
      navigate('/verificar-email', {
        state: {
          email,
          nome,
          usuarioId,
          destino: '/cliente/home',
        }
      });
    } catch (error) {
      const msg = (error as { response?: { data?: { erro?: string } } })?.response?.data?.erro || 'Erro ao criar conta';
      setErro(msg);
    } finally {
      setEnviando(false);
    }
  }

  // Estilo dos campos — arredondados, modernos, mobile-first
  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    padding: '14px 14px 14px 42px',
    color: 'var(--texto-principal)',
    fontFamily: 'var(--fonte-interface)',
    fontSize: '13px',
    letterSpacing: '0.02em',
    outline: 'none',
    transition: 'border-color 0.3s, background 0.3s',
    boxSizing: 'border-box' as const,
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--fonte-interface)',
    fontSize: '9px',
    letterSpacing: '0.18em',
    textTransform: 'uppercase' as const,
    color: 'var(--texto-secundario)',
    marginBottom: '6px',
    display: 'block',
  };

  const iconStyle: React.CSSProperties = {
    position: 'absolute',
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-disabled)',
  };

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = 'var(--cor-primaria)';
    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: 'var(--fundo-pagina)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Glow decorativo */}
      <div style={{
        position: 'absolute',
        top: '-100px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '350px',
        height: '350px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(212,130,10,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Botão Voltar */}
      <div style={{
        width: '100%',
        maxWidth: '380px',
        padding: '1rem 1.5rem 0',
        position: 'relative',
        zIndex: 1,
      }}>
        <button
          id="cadastro-voltar"
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
            fontSize: '10px',
            letterSpacing: '0.1em',
            color: 'var(--texto-secundario)',
            textTransform: 'uppercase' as const,
            padding: '8px 0',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'var(--cor-primaria)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'var(--texto-secundario)';
          }}
        >
          <ArrowLeft size={18} weight="regular" aria-hidden="true" />
          Voltar
        </button>
      </div>

      {/* Conteúdo */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        maxWidth: '380px',
        padding: '1rem 1.5rem 2rem',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Logo */}
        <div className="animate-fade-in" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: '2rem',
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(var(--cor-primaria-rgb), 0.15)',
            boxShadow: '0 0 40px rgba(212, 130, 10, 0.25)',
            marginBottom: '1rem',
          }}>
            <Scissors size={28} weight="regular" style={{ color: 'var(--cor-primaria)' }} aria-hidden="true" />
          </div>

          <h1 style={{
            fontFamily: 'var(--fonte-interface)',
            fontSize: '36px',
            letterSpacing: '0.06em',
            color: 'var(--texto-principal)',
            lineHeight: 1,
          }}>
            Criar Conta
          </h1>

          <p style={{
            fontFamily: 'var(--fonte-interface)',
            fontSize: '10px',
            letterSpacing: '0.2em',
            color: 'var(--texto-secundario)',
            textTransform: 'uppercase' as const,
            marginTop: '8px',
          }}>
            {nomeBarbearia} Barbearia
          </p>
        </div>

        {/* Formulário */}
        <form
          onSubmit={handleSubmit}
          className="animate-fade-in"
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.9rem',
            animationDelay: '0.1s',
          }}
        >
          {/* Erro */}
          {erro && (
            <div
              className="animate-fade-in"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 14px',
                background: 'rgba(113, 31, 31, 0.5)',
                border: '1px solid rgba(226, 75, 74, 0.3)',
                borderRadius: '8px',
                color: 'var(--error-text)',
                fontFamily: 'var(--fonte-interface)',
                fontSize: '11px',
              }}
            >
              <WarningCircle size={18} weight="regular" className="flex-shrink-0" aria-hidden="true" />
              <span>{erro}</span>
            </div>
          )}

          {/* Nome Completo */}
          <div>
            <label style={labelStyle}>Nome Completo</label>
            <div style={{ position: 'relative' }}>
              <User size={18} weight="regular" style={iconStyle} aria-hidden="true" />
              <input
                id="cadastro-nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo"
                required
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>
          </div>

          {/* Telefone WhatsApp */}
          <div>
            <label style={labelStyle}>WhatsApp</label>
            <div style={{ position: 'relative' }}>
              <Phone size={18} weight="regular" style={iconStyle} aria-hidden="true" />
              <input
                id="cadastro-telefone"
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                placeholder="(11) 99999-9999"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label style={labelStyle}>Email</label>
            <div style={{ position: 'relative' }}>
              <Envelope size={18} weight="regular" style={iconStyle} aria-hidden="true" />
              <input
                id="cadastro-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>
          </div>

          {/* Senha */}
          <div>
            <label style={labelStyle}>Senha</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} weight="regular" style={iconStyle} aria-hidden="true" />
              <input
                id="cadastro-senha"
                type={mostrarSenha ? "text" : "password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[var(--texto-secundario)] hover:text-[var(--text-primary)] transition-colors"
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                {mostrarSenha ? <EyeSlash size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Código de Indicação (Opcional) */}
          <div>
            <label style={labelStyle}>Código de Indicação (Opcional)</label>
            <div style={{ position: 'relative' }}>
              <Gift size={18} weight="regular" style={iconStyle} aria-hidden="true" />
              <input
                id="cadastro-codigo-indicacao"
                type="text"
                value={codigoIndicacao}
                onChange={(e) => setCodigoIndicacao(e.target.value.toUpperCase())}
                placeholder="Se tiver um, cole aqui"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>
          </div>

          {/* Botão Criar */}
          <button
            id="cadastro-submit"
            type="submit"
            disabled={enviando}
            style={{
              width: '100%',
              padding: '15px',
              marginTop: '8px',
              background: 'var(--cor-primaria)',
              border: 'none',
              borderRadius: '10px',
              color: 'var(--texto-sobre-primaria)',
              fontFamily: 'var(--fonte-interface)',
              fontSize: '14px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              cursor: enviando ? 'not-allowed' : 'pointer',
              opacity: enviando ? 0.6 : 1,
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 20px rgba(212, 130, 10, 0.3)',
            }}
            onMouseEnter={(e) => {
              if (!enviando) {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 30px rgba(212, 130, 10, 0.45)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(212, 130, 10, 0.3)';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            }}
          >
            {enviando ? 'Criando...' : 'Criar Minha Conta'}
          </button>
        </form>

        {/* Link para login */}
        <div style={{ marginTop: '1.25rem' }}>
          <button
            id="cadastro-ja-tenho-conta"
            type="button"
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--fonte-interface)',
              fontSize: '0.8125rem',
              letterSpacing: '0.08em',
              color: 'var(--cor-primaria)',
              padding: '8px',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'rgba(var(--cor-primaria-rgb), 0.15)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--cor-primaria)';
            }}
          >
            Já tenho conta, entrar
          </button>
        </div>
      </div>
    </div>
  );
}
