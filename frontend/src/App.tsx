import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Dashboard } from './pages/Dashboard';
import { Agenda } from './pages/Agenda';
import { Barbeiros } from './pages/Barbeiros';
import { Servicos } from './pages/Servicos';
import { Clientes } from './pages/Clientes';
import { Financeiro } from './pages/Financeiro';
import { Relatorios } from './pages/Relatorios';
import { Estoque } from './pages/Estoque';
import { Configuracoes } from './pages/Configuracoes';
import { Agendar } from './pages/publico/Agendar';
import { Fidelidade } from './pages/publico/Fidelidade';
import { LoadingSpinner } from './components/LoadingSpinner';
import { type ReactNode, useEffect } from 'react';
import { useTema } from './hooks/useTema';
import { useModoTema } from './hooks/useModoTema';

/** Rota protegida — redireciona para login se não autenticado */
function RotaProtegida({ children }: { children: ReactNode }) {
  const { usuario, carregando } = useAuth();
  if (carregando) return <LoadingSpinner />;
  if (!usuario) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

// Old Multi-tenant Tenant Client Auth
import { ClientAuthProvider } from './contexts/ClientAuthContext';
import { ClientLayout } from './layouts/ClientLayout';
import { Welcome } from './pages/tenant/Welcome';
import { LoginClient } from './pages/tenant/LoginClient';
import { RegisterClient } from './pages/tenant/RegisterClient';
import { Inicio } from './pages/tenant/app/Inicio';
import { AgendarTenant } from './pages/tenant/app/AgendarTenant';
import { Historico } from './pages/tenant/app/Historico';
import { FidelidadeTenant } from './pages/tenant/app/FidelidadeTenant';
import { Perfil } from './pages/tenant/app/Perfil';

// New Client App (Global)
import { ClienteAuthProvider } from './contexts/ClienteAuthContext';
import { ClienteLoginPrincipal } from './pages/cliente/ClienteLoginPrincipal';
import { ClienteCadastro } from './pages/cliente/ClienteCadastro';
import { ClienteHome } from './pages/cliente/ClienteHome';
import { ClienteLayout } from './layouts/ClienteLayout';
import { ClienteBarbeariaInicio } from './pages/cliente/barbearia/ClienteBarbeariaInicio';
import { ClienteBarbeariaAgendar } from './pages/cliente/barbearia/ClienteBarbeariaAgendar';
import { ClienteBarbeariaFidelidade } from './pages/cliente/barbearia/ClienteBarbeariaFidelidade';
import { ClienteBarbeariaPerfil } from './pages/cliente/barbearia/ClienteBarbeariaPerfil';

// Admin Login
import { AdminLogin } from './pages/admin/AdminLogin';
import { AdminPrimeiroAcesso } from './pages/admin/AdminPrimeiroAcesso';

// Barber App
import { BarbeiroAuthProvider } from './contexts/BarbeiroAuthContext';
import { BarbeiroLoginPage } from './pages/barbeiro/BarbeiroLoginPage';
import { BarbeiroLayout } from './layouts/BarbeiroLayout';
import { BarbeiroHoje } from './pages/barbeiro/BarbeiroHoje';
import { BarbeiroAgenda } from './pages/barbeiro/BarbeiroAgenda';
import { BarbeiroComissoes } from './pages/barbeiro/BarbeiroComissoes';
import { BarbeiroPerfil } from './pages/barbeiro/BarbeiroPerfil';

import { VerificarEmail } from './pages/VerificarEmail';

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
              <Routes>
                {/* === Tela Principal — Login do Cliente === */}
                <Route path="/" element={<ClienteLoginPrincipal />} />
                <Route path="/cadastro" element={<ClienteCadastro />} />
                <Route path="/verificar-email" element={<VerificarEmail />} />

                {/* === App do Cliente (após login) === */}
                <Route path="/cliente/home" element={<ClienteHome />} />

                <Route path="/cliente/barbearia/:barbeariaId" element={<ClienteLayout />}>
                  <Route index element={<ClienteBarbeariaInicio />} />
                  <Route path="agendar" element={<ClienteBarbeariaAgendar />} />
                  <Route path="fidelidade" element={<ClienteBarbeariaFidelidade />} />
                  <Route path="perfil" element={<ClienteBarbeariaPerfil />} />
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
                  <Route path="estoque" element={<Estoque />} />
                  <Route path="configuracoes" element={<Configuracoes />} />
                </Route>

                {/* Rotas legadas — redireciona para novas rotas */}
                <Route path="/login" element={<Navigate to="/admin/login" replace />} />
                <Route path="/cliente" element={<Navigate to="/" replace />} />
                <Route path="/cliente/login" element={<Navigate to="/" replace />} />
                <Route path="/cliente/register" element={<Navigate to="/cadastro" replace />} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BarbeiroAuthProvider>
          </ClienteAuthProvider>
        </ClientAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
