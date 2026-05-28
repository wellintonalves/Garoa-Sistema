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

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Rotas Públicas (Área do Cliente) */}
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
      </AuthProvider>
    </BrowserRouter>
  );
}
