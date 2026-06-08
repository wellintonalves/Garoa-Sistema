// Página de Login — estética industrial (âmbar + cantos retos + sem gradientes)
import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Mail, Lock, AlertCircle, UserPlus, User, CheckCircle2, ChevronLeft } from 'lucide-react';
import api from '../api/client';

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Estado do formulário de primeiro acesso
  const [mostrarRegistro, setMostrarRegistro] = useState(false);
  const [regNome, setRegNome] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regSenha, setRegSenha] = useState('');
  const [regErro, setRegErro] = useState('');
  const [regCarregando, setRegCarregando] = useState(false);
  const [adminCriado, setAdminCriado] = useState(false);

  const nomeBarbearia = import.meta.env.VITE_BARBEARIA_NOME || 'GAROA BARBEARIA';

  useEffect(() => {
    const cache = localStorage.getItem('temaBarbearia');
    if (cache) {
      try {
        const tema = JSON.parse(cache);
        if (tema.logo) setLogoUrl(tema.logo);
      } catch (e) {}
    }
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      await login(email, senha);
    } catch (error) {
      const msg = (error as { response?: { data?: { erro?: string } } })?.response?.data?.erro || 'Erro ao fazer login';
      setErro(msg);
    } finally {
      setCarregando(false);
    }
  }

  async function handleRegistro(e: FormEvent) {
    e.preventDefault();
    setRegErro('');
    setRegCarregando(true);

    try {
      await api.post('/auth/register', {
        nome: regNome,
        email: regEmail,
        senha: regSenha,
        papel: 'ADMIN',
      });

      setAdminCriado(true);
      setMostrarRegistro(false);
      // Limpa o formulário
      setRegNome('');
      setRegEmail('');
      setRegSenha('');
    } catch (error) {
      const msg = (error as { response?: { data?: { erro?: string } } })?.response?.data?.erro || 'Erro ao criar administrador';
      setRegErro(msg);
    } finally {
      setRegCarregando(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* Card de login */}
      <div className="relative w-full max-w-md animate-fade-in">
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            padding: '2.5rem',
          }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="object-contain" style={{ maxHeight: '80px', maxWidth: '240px' }} />
            ) : (
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '48px',
                  color: 'var(--text-primary)',
                  letterSpacing: '0.06em',
                  lineHeight: 1,
                }}
              >
                {nomeBarbearia}
              </h1>
            )}
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                marginTop: '8px',
              }}
            >
              Sistema de Gestão
            </p>
            {/* Linha decorativa âmbar */}
            <div
              style={{
                width: '40px',
                height: '2px',
                background: 'var(--amber)',
                marginTop: '16px',
              }}
            />
          </div>

          {/* Mensagem de sucesso após criar admin */}
          {adminCriado && (
            <div
              className="flex items-center gap-2 mb-4 animate-fade-in"
              style={{
                padding: '12px',
                background: 'var(--success)',
                border: '1px solid var(--success-text)',
                color: 'var(--success-text)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.04em',
              }}
            >
              <CheckCircle2 size={14} strokeWidth={1.5} className="flex-shrink-0" />
              <span>Administrador criado com sucesso! Faça o login.</span>
            </div>
          )}

          {/* ====== Formulário de Registro (Primeiro acesso) ====== */}
          {mostrarRegistro ? (
            <div className="animate-fade-in">
              <div className="flex items-center gap-2 mb-5">
                <button
                  type="button"
                  onClick={() => { setMostrarRegistro(false); setRegErro(''); }}
                  className="flex items-center justify-center transition-colors"
                  style={{
                    width: '28px',
                    height: '28px',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <ChevronLeft size={14} strokeWidth={1.5} />
                </button>
                <h2
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  Criar Administrador Inicial
                </h2>
              </div>

              <form onSubmit={handleRegistro} className="space-y-4">
                {/* Nome */}
                <div>
                  <label className="input-label">Nome</label>
                  <div className="relative">
                    <User size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                    <input
                      id="registro-nome"
                      type="text"
                      value={regNome}
                      onChange={(e) => setRegNome(e.target.value)}
                      placeholder="Nome do administrador"
                      required
                      className="ds-input"
                      style={{ paddingLeft: '36px' }}
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="input-label">Email</label>
                  <div className="relative">
                    <Mail size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                    <input
                      id="registro-email"
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="admin@email.com"
                      required
                      className="ds-input"
                      style={{ paddingLeft: '36px' }}
                    />
                  </div>
                </div>

                {/* Senha */}
                <div>
                  <label className="input-label">Senha</label>
                  <div className="relative">
                    <Lock size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                    <input
                      id="registro-senha"
                      type="password"
                      value={regSenha}
                      onChange={(e) => setRegSenha(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="ds-input"
                      style={{ paddingLeft: '36px' }}
                    />
                  </div>
                </div>

                {/* Erro do registro */}
                {regErro && (
                  <div
                    className="flex items-center gap-2 animate-fade-in"
                    style={{
                      padding: '12px',
                      background: 'var(--error)',
                      border: '1px solid var(--error-text)',
                      color: 'var(--error-text)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                    }}
                  >
                    <AlertCircle size={14} strokeWidth={1.5} className="flex-shrink-0" />
                    <span>{regErro}</span>
                  </div>
                )}

                {/* Botão de registrar */}
                <button
                  id="registro-submit"
                  type="submit"
                  disabled={regCarregando}
                  className="btn-primary w-full justify-center"
                >
                  {regCarregando ? 'Criando...' : 'Criar Administrador'}
                </button>
              </form>
            </div>
          ) : (
            /* ====== Formulário de Login ====== */
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="input-label">Email</label>
                  <div className="relative">
                    <Mail size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      className="ds-input"
                      style={{ paddingLeft: '36px' }}
                    />
                  </div>
                </div>

                {/* Senha */}
                <div>
                  <label className="input-label">Senha</label>
                  <div className="relative">
                    <Lock size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                    <input
                      id="login-senha"
                      type="password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="ds-input"
                      style={{ paddingLeft: '36px' }}
                    />
                  </div>
                </div>

                {/* Erro */}
                {erro && (
                  <div
                    className="flex items-center gap-2 animate-fade-in"
                    style={{
                      padding: '12px',
                      background: 'var(--error)',
                      border: '1px solid var(--error-text)',
                      color: 'var(--error-text)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                    }}
                  >
                    <AlertCircle size={14} strokeWidth={1.5} className="flex-shrink-0" />
                    <span>{erro}</span>
                  </div>
                )}

                {/* Botão */}
                <button
                  id="login-submit"
                  type="submit"
                  disabled={carregando}
                  className="btn-primary w-full justify-center"
                >
                  {carregando ? 'Entrando...' : 'Entrar'}
                </button>
              </form>

              {/* Botão Primeiro Acesso */}
              {!adminCriado && (
                <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
                  <button
                    id="primeiro-acesso"
                    type="button"
                    onClick={() => { setMostrarRegistro(true); setErro(''); }}
                    className="btn-secondary w-full justify-center"
                  >
                    <UserPlus size={14} strokeWidth={1.5} />
                    Primeiro acesso
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Rodapé */}
        <p
          className="text-center mt-4"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-disabled)',
          }}
        >
          © {new Date().getFullYear()} {nomeBarbearia}
        </p>
      </div>
    </div>
  );
}
