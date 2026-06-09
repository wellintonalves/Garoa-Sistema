// Tela de login do administrador — /admin/login
// Visual sóbrio e profissional
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Mail, Lock, AlertCircle, Shield, ArrowLeft, CheckCircle2, UserPlus, User, ChevronLeft } from 'lucide-react';
import api from '../../api/client';

export function AdminLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  
  
  // Estado do formulário de primeiro acesso
  const [mostrarRegistro, setMostrarRegistro] = useState(false);
  const [regNome, setRegNome] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regSenha, setRegSenha] = useState('');
  const [regErro, setRegErro] = useState('');
  const [regCarregando, setRegCarregando] = useState(false);
  const [adminCriado, setAdminCriado] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await login(email, senha);
      navigate('/admin');
      return;
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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      background: '#0F172A',
    }}>
      <div className="animate-fade-in" style={{
        width: '100%',
        maxWidth: '420px',
      }}>
        {/* Card principal */}
        <div style={{
          background: '#1E293B',
          border: '1px solid #334155',
          borderTop: '2px solid #F59E0B',
          padding: '2.5rem',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '2rem',
          }}>
            <div style={{
              width: '52px',
              height: '52px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(245, 158, 11, 0.10)',
              marginBottom: '1rem',
            }}>
              <Shield size={24} style={{ color: '#F59E0B' }} />
            </div>

            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '32px',
              letterSpacing: '0.06em',
              color: '#FFFFFF',
              lineHeight: 1,
            }}>
              Painel Administrativo
            </h1>

            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase' as const,
              color: '#94A3B8',
              marginTop: '8px',
            }}>
              Acesso restrito
            </p>

            {/* Linha decorativa */}
            <div style={{
              width: '40px',
              height: '2px',
              background: '#F59E0B',
              marginTop: '16px',
            }} />
          </div>

          {/* Mensagem de sucesso após criar admin */}
          {adminCriado && (
            <div
              className="animate-fade-in"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '1rem',
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
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '1.25rem',
              }}>
                <button
                  type="button"
                  onClick={() => { setMostrarRegistro(false); setRegErro(''); }}
                  style={{
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    border: '1px solid #334155',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s',
                  }}
                >
                  <ChevronLeft size={14} strokeWidth={1.5} />
                </button>
                <h2 style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#FFFFFF',
                }}>
                  Criar Administrador Inicial
                </h2>
              </div>

              <form onSubmit={handleRegistro} className="space-y-4">
                <div>
                  <label className="input-label">Nome</label>
                  <div className="relative">
                    <User size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                    <input
                      id="admin-registro-nome"
                      type="text"
                      value={regNome}
                      onChange={(e) => setRegNome(e.target.value)}
                      placeholder="Nome do administrador"
                      required
                      className="w-full bg-[#1E293B] border border-[#334155] rounded text-[#FFFFFF] placeholder-[#64748B] focus:outline-none focus:border-[#F59E0B] py-2.5"
                      style={{ paddingLeft: '36px' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="input-label">Email</label>
                  <div className="relative">
                    <Mail size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                    <input
                      id="admin-registro-email"
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="admin@email.com"
                      required
                      className="w-full bg-[#1E293B] border border-[#334155] rounded text-[#FFFFFF] placeholder-[#64748B] focus:outline-none focus:border-[#F59E0B] py-2.5"
                      style={{ paddingLeft: '36px' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="input-label">Senha</label>
                  <div className="relative">
                    <Lock size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                    <input
                      id="admin-registro-senha"
                      type="password"
                      value={regSenha}
                      onChange={(e) => setRegSenha(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="w-full bg-[#1E293B] border border-[#334155] rounded text-[#FFFFFF] placeholder-[#64748B] focus:outline-none focus:border-[#F59E0B] py-2.5"
                      style={{ paddingLeft: '36px' }}
                    />
                  </div>
                </div>

                {regErro && (
                  <div
                    className="animate-fade-in"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
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

                <button
                  id="admin-registro-submit"
                  type="submit"
                  disabled={regCarregando}
                  className="flex items-center gap-2 py-3 bg-[#F59E0B] hover:bg-[#D97706] text-[#0F172A] font-bold uppercase tracking-widest text-xs rounded transition-colors w-full justify-center"
                >
                  {regCarregando ? 'Criando...' : 'Criar Administrador'}
                </button>
              </form>
            </div>
          ) : (
            /* ====== Formulário de Login ====== */
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="input-label">Email</label>
                  <div className="relative">
                    <Mail size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                    <input
                      id="admin-login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@email.com"
                      required
                      className="w-full bg-[#1E293B] border border-[#334155] rounded text-[#FFFFFF] placeholder-[#64748B] focus:outline-none focus:border-[#F59E0B] py-2.5"
                      style={{ paddingLeft: '36px' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="input-label">Senha</label>
                  <div className="relative">
                    <Lock size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                    <input
                      id="admin-login-senha"
                      type="password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full bg-[#1E293B] border border-[#334155] rounded text-[#FFFFFF] placeholder-[#64748B] focus:outline-none focus:border-[#F59E0B] py-2.5"
                      style={{ paddingLeft: '36px' }}
                    />
                  </div>
                </div>

                {erro && (
                  <div
                    className="animate-fade-in"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
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

                <button
                  id="admin-login-submit"
                  type="submit"
                  disabled={carregando}
                  className="flex items-center gap-2 py-3 bg-[#F59E0B] hover:bg-[#D97706] text-[#0F172A] font-bold uppercase tracking-widest text-xs rounded transition-colors w-full justify-center"
                >
                  {carregando ? 'Entrando...' : 'Entrar como Administrador'}
                </button>
              </form>

              {/* Botão Primeiro Acesso */}
              {!adminCriado && (
                <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #334155' }}>
                  <button
                    id="admin-primeiro-acesso"
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

        {/* Link Voltar */}
        <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
          <button
            id="admin-voltar"
            type="button"
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.1em',
              color: '#94A3B8',
              textTransform: 'uppercase' as const,
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = '#F59E0B';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = '#94A3B8';
            }}
          >
            <ArrowLeft size={14} strokeWidth={1.5} />
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
