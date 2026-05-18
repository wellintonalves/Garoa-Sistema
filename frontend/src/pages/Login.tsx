// Página de Login — tela cheia com tema escuro e dourado
import { useState, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Mail, Lock, AlertCircle, UserPlus, User, CheckCircle2, ChevronLeft } from 'lucide-react';
import api from '../api/client';

export function Login() {
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

  const nomeBarbearia = import.meta.env.VITE_BARBEARIA_NOME || 'Garoa Barbearia';

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
    <div className="min-h-screen flex items-center justify-center bg-[#0c0c0e] p-4">
      {/* Gradiente de fundo decorativo */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-600/5 rounded-full blur-3xl" />
      </div>

      {/* Card de login */}
      <div className="relative w-full max-w-md animate-fade-in">
        <div className="bg-neutral-900/80 backdrop-blur-xl border border-neutral-800 rounded-2xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <img src="/logo-garoa.jpg" alt="Garoa Logo" className="w-20 h-20 rounded-full object-cover mb-4 shadow-lg shadow-cyan-500/20 border border-cyan-500/20" />
            <h1 className="text-2xl font-bold text-white">{nomeBarbearia}</h1>
            <p className="text-neutral-500 text-sm mt-1">Sistema de Gestão</p>
          </div>

          {/* Mensagem de sucesso após criar admin */}
          {adminCriado && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm animate-fade-in">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
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
                  className="p-1 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h2 className="text-sm font-semibold text-neutral-300">Criar Administrador Inicial</h2>
              </div>

              <form onSubmit={handleRegistro} className="space-y-4">
                {/* Nome */}
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5">Nome</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                    <input
                      id="registro-nome"
                      type="text"
                      value={regNome}
                      onChange={(e) => setRegNome(e.target.value)}
                      placeholder="Nome do administrador"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                    <input
                      id="registro-email"
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="admin@email.com"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                    />
                  </div>
                </div>

                {/* Senha */}
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                    <input
                      id="registro-senha"
                      type="password"
                      value={regSenha}
                      onChange={(e) => setRegSenha(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="w-full pl-10 pr-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                    />
                  </div>
                </div>

                {/* Erro do registro */}
                {regErro && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm animate-fade-in">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{regErro}</span>
                  </div>
                )}

                {/* Botão de registrar */}
                <button
                  id="registro-submit"
                  type="submit"
                  disabled={regCarregando}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-neutral-900 font-semibold text-sm rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
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
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                    />
                  </div>
                </div>

                {/* Senha */}
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                    <input
                      id="login-senha"
                      type="password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                    />
                  </div>
                </div>

                {/* Erro */}
                {erro && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm animate-fade-in">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{erro}</span>
                  </div>
                )}

                {/* Botão */}
                <button
                  id="login-submit"
                  type="submit"
                  disabled={carregando}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-neutral-900 font-semibold text-sm rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
                >
                  {carregando ? 'Entrando...' : 'Entrar'}
                </button>
              </form>

              {/* Botão Primeiro Acesso — só aparece se o admin ainda não foi criado nesta sessão */}
              {!adminCriado && (
                <div className="mt-5 pt-5 border-t border-neutral-800">
                  <button
                    id="primeiro-acesso"
                    type="button"
                    onClick={() => { setMostrarRegistro(true); setErro(''); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-600 text-neutral-300 hover:text-white font-medium text-sm rounded-lg transition-all duration-200"
                  >
                    <UserPlus className="w-4 h-4" />
                    Primeiro acesso
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Rodapé */}
        <p className="text-center text-xs text-neutral-600 mt-4">
          © {new Date().getFullYear()} {nomeBarbearia}. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
