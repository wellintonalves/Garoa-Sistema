import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Login } from './pages/Login';
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
import { type ReactNode } from 'react';

/** Rota protegida — redireciona para login se não autenticado */
function RotaProtegida({ children }: { children: ReactNode }) {
  const { usuario, carregando } = useAuth();
  if (carregando) return <LoadingSpinner />;
  if (!usuario) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Rota pública — redireciona para dashboard se já autenticado */
function RotaPublica({ children }: { children: ReactNode }) {
  const { usuario, carregando } = useAuth();
  if (carregando) return <LoadingSpinner />;
  if (usuario) return <Navigate to="/" replace />;
  return <>{children}</>;
}

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

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ClientAuthProvider>
        <Routes>
          {/* Área do Cliente (Multi-tenant) */}
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

          {/* Rotas Públicas Antigas (Serão depreciadas) */}
          <Route path="/agendar" element={<Agendar />} />
          <Route path="/fidelidade" element={<Fidelidade />} />

          {/* Login */}
          <Route path="/login" element={<RotaPublica><Login /></RotaPublica>} />

          {/* Dashboard e módulos — protegidos */}
          <Route path="/" element={<RotaProtegida><DashboardLayout /></RotaProtegida>}>
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

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ClientAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
