// Layout do app do cliente dentro de uma barbearia — menu inferior com 4 abas
import { Outlet, useNavigate, useLocation, useParams, Navigate } from 'react-router-dom';
import { Home, Calendar, Star, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import clienteApi from '../api/clienteApi';
import { useTema } from '../hooks/useTema';
import { useClienteAuth } from '../hooks/useClienteAuth';

interface BarbeariaInfo {
  id: string;
  nome: string;
  slug: string;
  logo: string | null;
}

export function ClienteLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { barbeariaId } = useParams<{ barbeariaId: string }>();
  const [barbearia, setBarbearia] = useState<BarbeariaInfo | null>(null);
  const { cliente, carregando: authCarregando } = useClienteAuth();
  const { carregarTemaCliente } = useTema();

  useEffect(() => {
    if (barbeariaId) {
      // Busca dados da barbearia via minhas-barbearias para obter o nome
      clienteApi.get('/cliente/minhas-barbearias').then((res) => {
        const found = res.data.find((b: BarbeariaInfo) => b.id === barbeariaId);
        if (found) {
          setBarbearia(found);
          // Busca identidade visual
          carregarTemaCliente(found.slug);
        }
      }).catch(() => {
        navigate('/cliente/home');
      });
    }
  }, [barbeariaId, carregarTemaCliente]);

  // Route guard — bloqueia acesso sem autenticação de cliente (após todos os hooks)
  if (!authCarregando && !cliente) {
    return <Navigate to="/" replace />;
  }

  const basePath = `/cliente/barbearia/${barbeariaId}`;

  const tabs = [
    { name: 'Início', path: basePath, icon: Home },
    { name: 'Agendar', path: `${basePath}/agendar`, icon: Calendar },
    { name: 'Fidelidade', path: `${basePath}/fidelidade`, icon: Star },
    { name: 'Perfil', path: `${basePath}/perfil`, icon: User },
  ];

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden" style={{ background: 'var(--fundo-pagina)', color: 'var(--text-primary)' }}>
      <div className="flex-1 overflow-y-auto pb-24">
        <Outlet context={{ barbearia, barbeariaId }} />
      </div>

      {/* Bottom Navigation */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }} 
           className="px-2 py-2 flex justify-between items-center z-50">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path ||
            (tab.path !== basePath && location.pathname.startsWith(tab.path));

          return (
            <button
              key={tab.name}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center justify-center w-full p-2 transition-all"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: isActive ? 'var(--amber)' : 'var(--text-disabled)',
              }}
            >
              <Icon size={22} style={{ marginBottom: '4px', opacity: isActive ? 1 : 0.7 }} />
              <span style={{
                fontFamily: 'var(--fonte-interface)',
                fontSize: '9px',
                letterSpacing: '0.08em',
                fontWeight: isActive ? 600 : 400,
              }}>
                {tab.name}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
