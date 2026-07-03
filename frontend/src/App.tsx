import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import { DashboardLayout } from './layouts/DashboardLayout';
import { LoadingSpinner } from './components/LoadingSpinner';
import { type ReactNode, useEffect, lazy, Suspense } from 'react';
import { useTema } from './hooks/useTema';
import { useModoTema } from './hooks/useModoTema';

import { ClientAuthProvider } from './contexts/ClientAuthContext';
import { ClientLayout } from './layouts/ClientLayout';
import { ClienteAuthProvider } from './contexts/ClienteAuthContext';
import { ClienteLayout } from './layouts/ClienteLayout';
import { BarbeiroAuthProvider } from './contexts/BarbeiroAuthContext';
import { BarbeiroLayout } from './layouts/BarbeiroLayout';

// Páginas usando React.lazy
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Agenda = lazy(() => import('./pages/Agenda').then(m => ({ default: m.Agenda })));
const Barbeiros = lazy(() => import('./pages/Barbeiros').then(m => ({ default: m.Barbeiros })));
const Servicos = lazy(() => import('./pages/Servicos').then(m => ({ default: m.Servicos })));
const Clientes = lazy(() => import('./pages/Clientes').then(m => ({ default: m.Clientes })));
const Financeiro = lazy(() => import('./pages/Financeiro').then(m => ({ default: m.Financeiro })));
const Relatorios = lazy(() => import('./pages/Relatorios').then(m => ({ default: m.Relatorios })));
const Vendas = lazy(() => import('./pages/Vendas').then(m => ({ default: m.Vendas })));
const Configuracoes = lazy(() => import('./pages/Configuracoes').then(m => ({ default: m.Configuracoes })));
const Agendar = lazy(() => import('./pages/publico/Agendar').then(m => ({ default: m.Agendar })));
const Fidelidade = lazy(() => import('./pages/publico/Fidelidade').then(m => ({ default: m.Fidelidade })));

const Welcome = lazy(() => import('./pages/tenant/Welcome').then(m => ({ default: m.Welcome })));
const LoginClient = lazy(() => import('./pages/tenant/LoginClient').then(m => ({ default: m.LoginClient })));
const RegisterClient = lazy(() => import('./pages/tenant/RegisterClient').then(m => ({ default: m.RegisterClient })));
const Inicio = lazy(() => import('./pages/tenant/app/Inicio').then(m => ({ default: m.Inicio })));
const AgendarTenant = lazy(() => import('./pages/tenant/app/AgendarTenant').then(m => ({ default: m.AgendarTenant })));
const Historico = lazy(() => import('./pages/tenant/app/Historico').then(m => ({ default: m.Historico })));
const FidelidadeTenant = lazy(() => import('./pages/tenant/app/FidelidadeTenant').then(m => ({ default: m.FidelidadeTenant })));
const Perfil = lazy(() => import('./pages/tenant/app/Perfil').then(m => ({ default: m.Perfil })));

const ClienteLoginPrincipal = lazy(() => import('./pages/cliente/ClienteLoginPrincipal').then(m => ({ default: m.ClienteLoginPrincipal })));
const ClienteCadastro = lazy(() => import('./pages/cliente/ClienteCadastro').then(m => ({ default: m.ClienteCadastro })));
const ClienteHome = lazy(() => import('./pages/cliente/ClienteHome').then(m => ({ default: m.ClienteHome })));
const ClienteBarbeariaInicio = lazy(() => import('./pages/cliente/barbearia/ClienteBarbeariaInicio').then(m => ({ default: m.ClienteBarbeariaInicio })));
const ClienteBarbeariaAgendar = lazy(() => import('./pages/cliente/barbearia/ClienteBarbeariaAgendar').then(m => ({ default: m.ClienteBarbeariaAgendar })));
const ClienteBarbeariaFidelidade = lazy(() => import('./pages/cliente/barbearia/ClienteBarbeariaFidelidade').then(m => ({ default: m.ClienteBarbeariaFidelidade })));
const ClienteBarbeariaPerfil = lazy(() => import('./pages/cliente/barbearia/ClienteBarbeariaPerfil').then(m => ({ default: m.ClienteBarbeariaPerfil })));
const ClienteBarbeariaChat = lazy(() => import('./pages/cliente/barbearia/ClienteBarbeariaChat').then(m => ({ default: m.ClienteBarbeariaChat })));

const AdminLogin = lazy(() => import('./pages/admin/AdminLogin').then(m => ({ default: m.AdminLogin })));
const AdminPrimeiroAcesso = lazy(() => import('./pages/admin/AdminPrimeiroAcesso').then(m => ({ default: m.AdminPrimeiroAcesso })));
const AdminChat = lazy(() => import('./pages/admin/AdminChat').then(m => ({ default: m.AdminChat })));
const AdminFidelidade = lazy(() => import('./pages/admin/Fidelidade').then(m => ({ default: m.Fidelidade })));

const BarbeiroLoginPage = lazy(() => import('./pages/barbeiro/BarbeiroLoginPage').then(m => ({ default: m.BarbeiroLoginPage })));
const BarbeiroHoje = lazy(() => import('./pages/barbeiro/BarbeiroHoje').then(m => ({ default: m.BarbeiroHoje })));
const BarbeiroAgenda = lazy(() => import('./pages/barbeiro/BarbeiroAgenda').then(m => ({ default: m.BarbeiroAgenda })));
const BarbeiroComissoes = lazy(() => import('./pages/barbeiro/BarbeiroComissoes').then(m => ({ default: m.BarbeiroComissoes })));
const BarbeiroPerfil = lazy(() => import('./pages/barbeiro/BarbeiroPerfil').then(m => ({ default: m.BarbeiroPerfil })));

const VerificarEmail = lazy(() => import('./pages/VerificarEmail').then(m => ({ default: m.VerificarEmail })));
const RecuperarSenha = lazy(() => import('./pages/RecuperarSenha').then(m => ({ default: m.RecuperarSenha })));

/** Rota protegida — só permite acesso a usuários com papel ADMIN */
function RotaProtegida({ children }: { children: ReactNode }) {
  const { usuario, carregando } = useAuth();
  if (carregando) return <LoadingSpinner />;
  if (!usuario || usuario.papel !== 'ADMIN') return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

export function App() {
  useModoTema();
  const { carregarTemaCache } = useTema();

  useEffect(() => {
    carregarTemaCache();
  }, [carregarTemaCache]);

  return (
    <BrowserRouter>
      <AuthProvider>
        <ClientAuthProvider>
          <ClienteAuthProvider>
            <BarbeiroAuthProvider>
              <Suspense fallback={<div className="h-screen w-full flex items-center justify-center"><LoadingSpinner /></div>}>
                <Routes>
                  {/* === Tela Principal — Login do Cliente === */}
                  <Route path="/" element={<ClienteLoginPrincipal />} />
                  <Route path="/cadastro" element={<ClienteCadastro />} />
                  <Route path="/verificar-email" element={<VerificarEmail />} />
                  <Route path="/recuperar-senha" element={<RecuperarSenha />} />

                  {/* === App do Cliente (após login) === */}
                  <Route path="/cliente/home" element={<ClienteHome />} />

                  <Route path="/cliente/barbearia/:barbeariaId" element={<ClienteLayout />}>
                    <Route index element={<ClienteBarbeariaInicio />} />
                    <Route path="agendar" element={<ClienteBarbeariaAgendar />} />
                    <Route path="fidelidade" element={<ClienteBarbeariaFidelidade />} />
                    <Route path="perfil" element={<ClienteBarbeariaPerfil />} />
                    <Route path="chat" element={<ClienteBarbeariaChat />} />
                  </Route>

                  {/* === Login do Administrador === */}
                  <Route path="/admin/login" element={<AdminLogin />} />
                  <Route path="/admin/primeiro-acesso" element={<AdminPrimeiroAcesso />} />

                  {/* === Login do Barbeiro === */}
                  <Route path="/barbeiro/login" element={<BarbeiroLoginPage />} />

                  {/* === App do Barbeiro (após login) === */}
                  <Route path="/barbeiro" element={<BarbeiroLayout />}>
                    <Route path="hoje" element={<BarbeiroHoje />} />
                    <Route path="agenda" element={<BarbeiroAgenda />} />
                    <Route path="comissoes" element={<BarbeiroComissoes />} />
                    <Route path="perfil" element={<BarbeiroPerfil />} />
                  </Route>

                  {/* === Área do Cliente (Multi-tenant) - Legado === */}
                  <Route path="/b/:slug" element={<Welcome />} />
                  <Route path="/b/:slug/login" element={<LoginClient />} />
                  <Route path="/b/:slug/register" element={<RegisterClient />} />

                  <Route path="/b/:slug/app" element={<ClientLayout />}>
                    <Route index element={<Inicio />} />
                    <Route path="agendar" element={<AgendarTenant />} />
                    <Route path="historico" element={<Historico />} />
                    <Route path="fidelidade" element={<FidelidadeTenant />} />
                    <Route path="perfil" element={<Perfil />} />
                  </Route>

                  {/* === Rotas Públicas Antigas (Serão depreciadas) === */}
                  <Route path="/agendar" element={<Agendar />} />
                  <Route path="/fidelidade" element={<Fidelidade />} />

                  {/* === Admin / Painel — protegido === */}
                  <Route path="/admin" element={<RotaProtegida><DashboardLayout /></RotaProtegida>}>
                    <Route index element={<Dashboard />} />
                    <Route path="agenda" element={<Agenda />} />
                    <Route path="barbeiros" element={<Barbeiros />} />
                    <Route path="servicos" element={<Servicos />} />
                    <Route path="clientes" element={<Clientes />} />
                    <Route path="financeiro" element={<Financeiro />} />
                    <Route path="relatorios" element={<Relatorios />} />
                    <Route path="vendas" element={<Vendas />} />
                    <Route path="configuracoes" element={<Configuracoes />} />
                    <Route path="fidelidade" element={<AdminFidelidade />} />
                    <Route path="chat" element={<AdminChat />} />
                  </Route>

                  {/* Rotas legadas — redireciona para novas rotas */}
                  <Route path="/login" element={<Navigate to="/admin/login" replace />} />
                  <Route path="/cliente" element={<Navigate to="/" replace />} />
                  <Route path="/cliente/login" element={<Navigate to="/" replace />} />
                  <Route path="/cliente/register" element={<Navigate to="/cadastro" replace />} />
                  <Route path="/admin/estoque" element={<Navigate to="/admin/vendas" replace />} />

                  {/* Fallback */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </BarbeiroAuthProvider>
          </ClienteAuthProvider>
        </ClientAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
