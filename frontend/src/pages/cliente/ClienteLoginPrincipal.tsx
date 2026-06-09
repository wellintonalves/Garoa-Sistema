// Tela principal de login — focada no cliente
// Visual premium de barbearia, mobile-first
import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useClienteAuth } from '../../hooks/useClienteAuth';
import { useTema } from '../../hooks/useTema';
import { Mail, Lock, AlertCircle, Scissors, Settings, Shield, X } from 'lucide-react';
import clienteApi from '../../api/clienteApi';

export function ClienteLoginPrincipal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { cliente, carregando: authCarregando, login } = useClienteAuth();
  const { limparTema } = useTema();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);

  const [identidade, setIdentidade] = useState<{ logo: string | null; nome: string; corPrimaria?: string; fonte?: string }>({
    logo: null,
    nome: import.meta.env.VITE_BARBEARIA_NOME || 'GAROA'
  });

  useEffect(() => {
    limparTema();
    const slug = searchParams.get('slug');
    if (slug) {
      clienteApi.get(`/b/${slug}/identidade`).then((res) => {
        setIdentidade({
          logo: res.data.logo || null,
          nome: res.data.nome || import.meta.env.VITE_BARBEARIA_NOME || 'GAROA',
          corPrimaria: res.data.corPrimaria,
          fonte: res.data.fonte
        });
      }).catch(() => {});
    }
  }, [searchParams, limparTema]);

  // Se já está logado, redireciona
  if (!authCarregando && cliente) {
    navigate('/cliente/home', { replace: true });
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await login(email, senha);
      navigate('/cliente/home');
    } catch (error) {
      const msg = (error as { response?: { data?: { erro?: string } } })?.response?.data?.erro || 'Email ou senha incorretos';
      setErro(msg);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'linear-gradient(180deg, #0A0A0A 0%, #141414 40%, #1A1408 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Glow decorativo de fundo */}
      <div style={{
        position: 'absolute',
        top: '-120px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(212,130,10,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Botão Equipe — canto superior direito, discreto */}
      <button
        id="btn-equipe"
        type="button"
        onClick={() => setMostrarModal(true)}
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '8px',
          padding: '8px 12px',
          cursor: 'pointer',
          color: 'var(--text-disabled)',
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase' as const,
          transition: 'all 0.3s ease',
          zIndex: 10,
          backdropFilter: 'blur(8px)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = 'var(--text-disabled)';
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
        }}
      >
        <Settings size={13} strokeWidth={1.5} />
        <span>Equipe</span>
      </button>

      {/* Conteúdo principal */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        maxWidth: '380px',
        padding: '2rem 1.5rem',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Logo e nome da barbearia */}
        <div className="animate-fade-in" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: '3rem',
        }}>
          {/* Ícone ou Logo com glow */}
          {identidade.logo ? (
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 60px rgba(212, 130, 10, 0.3), 0 0 120px rgba(212, 130, 10, 0.1)',
              marginBottom: '1.5rem',
              overflow: 'hidden'
            }}>
              <img src={identidade.logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ) : (
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, var(--amber) 0%, #E8A020 50%, var(--amber-light) 100%)',
              boxShadow: '0 0 60px rgba(212, 130, 10, 0.3), 0 0 120px rgba(212, 130, 10, 0.1)',
              marginBottom: '1.5rem',
            }}>
              <Scissors size={38} style={{ color: '#0A0A0A' }} />
            </div>
          )}

          {/* Nome da barbearia */}
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '52px',
            letterSpacing: '0.08em',
            color: 'var(--text-primary)',
            lineHeight: 1,
            textAlign: 'center',
          }}>
            {identidade.nome}
          </h1>

          {/* Subtítulo */}
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.35em',
            color: 'var(--cor-icone)',
            textTransform: 'uppercase' as const,
            marginTop: '10px',
          }}>
            Barbearia
          </p>

          {/* Linha decorativa */}
          <div style={{
            width: '50px',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, var(--amber), transparent)',
            marginTop: '1.5rem',
          }} />
        </div>

        {/* Formulário de login */}
        <form
          onSubmit={handleSubmit}
          className="animate-fade-in"
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            animationDelay: '0.15s',
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
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
              }}
            >
              <AlertCircle size={14} strokeWidth={1.5} className="flex-shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* Campo Email */}
          <div>
            <label style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase' as const,
              color: 'var(--text-muted)',
              marginBottom: '6px',
              display: 'block',
            }}>
              Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} strokeWidth={1.5} style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-disabled)',
              }} />
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px',
                  padding: '14px 14px 14px 42px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  letterSpacing: '0.02em',
                  outline: 'none',
                  transition: 'border-color 0.3s, background 0.3s',
                  boxSizing: 'border-box' as const,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--amber)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                }}
              />
            </div>
          </div>

          {/* Campo Senha */}
          <div>
            <label style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase' as const,
              color: 'var(--text-muted)',
              marginBottom: '6px',
              display: 'block',
            }}>
              Senha
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} strokeWidth={1.5} style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-disabled)',
              }} />
              <input
                id="login-senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px',
                  padding: '14px 14px 14px 42px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  letterSpacing: '0.1em',
                  outline: 'none',
                  transition: 'border-color 0.3s, background 0.3s',
                  boxSizing: 'border-box' as const,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--amber)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                }}
              />
            </div>
          </div>

          {/* Botão Entrar */}
          <button
            id="login-submit"
            type="submit"
            disabled={enviando}
            style={{
              width: '100%',
              padding: '15px',
              marginTop: '8px',
              background: 'linear-gradient(135deg, var(--amber) 0%, #E09818 100%)',
              border: 'none',
              borderRadius: '10px',
              color: '#0A0A0A',
              fontFamily: 'var(--font-body)',
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
            {enviando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {/* Link criar conta */}
        <div className="animate-fade-in" style={{ marginTop: '1.5rem', animationDelay: '0.3s' }}>
          <button
            id="btn-criar-conta"
            type="button"
            onClick={() => navigate('/cadastro')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              letterSpacing: '0.08em',
              color: 'var(--cor-icone)',
              padding: '8px',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--amber-light)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--amber)';
            }}
          >
            Criar minha conta
          </button>
        </div>
      </div>

      {/* Footer */}
      <p style={{
        padding: '1.5rem',
        fontFamily: 'var(--font-mono)',
        fontSize: '9px',
        color: 'var(--text-disabled)',
        letterSpacing: '0.15em',
        textTransform: 'uppercase' as const,
      }}>
        © {new Date().getFullYear()} {identidade.nome} Barbearia
      </p>

      {/* ====== Modal de acesso da equipe ====== */}
      {mostrarModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          {/* Backdrop */}
          <div
            onClick={() => setMostrarModal(false)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(8px)',
            }}
          />

          {/* Modal content */}
          <div
            className="animate-fade-in"
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '340px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '2rem',
              boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
            }}
          >
            {/* Fechar */}
            <button
              type="button"
              onClick={() => setMostrarModal(false)}
              style={{
                position: 'absolute',
                top: '14px',
                right: '14px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-disabled)',
                padding: '4px',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = 'var(--text-disabled)';
              }}
            >
              <X size={18} strokeWidth={1.5} />
            </button>

            {/* Título da modal */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: '1.75rem',
            }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--amber-dim)',
                marginBottom: '12px',
              }}>
                <Settings size={20} style={{ color: 'var(--cor-icone)' }} />
              </div>
              <h2 style={{
                fontFamily: 'var(--font-body)',
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '4px',
              }}>
                Acesso da Equipe
              </h2>
              <p style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--text-muted)',
                letterSpacing: '0.1em',
              }}>
                Selecione seu perfil
              </p>
            </div>

            {/* Opções */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              {/* Sou Administrador */}
              <button
                id="btn-admin-login"
                type="button"
                onClick={() => {
                  setMostrarModal(false);
                  navigate('/admin/login');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  width: '100%',
                  padding: '16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  textAlign: 'left' as const,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--amber)';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(212, 130, 10, 0.06)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--amber-dim)',
                  flexShrink: 0,
                }}>
                  <Shield size={18} style={{ color: 'var(--cor-icone)' }} />
                </div>
                <div>
                  <p style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '2px',
                  }}>
                    Sou Administrador
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.06em',
                  }}>
                    Painel de gestão da barbearia
                  </p>
                </div>
              </button>

              {/* Sou Barbeiro */}
              <button
                id="btn-barbeiro-login"
                type="button"
                onClick={() => {
                  setMostrarModal(false);
                  navigate('/barbeiro/login');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  width: '100%',
                  padding: '16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  textAlign: 'left' as const,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--amber)';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(212, 130, 10, 0.06)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--amber-dim)',
                  flexShrink: 0,
                }}>
                  <Scissors size={18} style={{ color: 'var(--cor-icone)' }} />
                </div>
                <div>
                  <p style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '2px',
                  }}>
                    Sou Barbeiro
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.06em',
                  }}>
                    Minha agenda e comissões
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
