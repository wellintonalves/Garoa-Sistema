// Layout do app do barbeiro com navegação inferior
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Clock, Calendar, DollarSign, User } from 'lucide-react';
import { useBarbeiroAuth } from '../hooks/useBarbeiroAuth';

export function BarbeiroLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { barbeiro, carregando } = useBarbeiroAuth();

  if (!carregando && !barbeiro) {
    return <Navigate to="/barbeiro/login" replace />;
  }

  const tabs = [
    { name: 'Hoje', path: '/barbeiro/hoje', icon: Clock },
    { name: 'Agenda', path: '/barbeiro/agenda', icon: Calendar },
    { name: 'Comissões', path: '/barbeiro/comissoes', icon: DollarSign },
    { name: 'Perfil', path: '/barbeiro/perfil', icon: User },
  ];

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--fundo-pagina)', color: 'var(--text-primary)' }}>
      <div className="flex-1 overflow-y-auto pb-20">
        <Outlet context={{ barbeiro }} />
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full px-2 py-2 flex justify-between items-center z-50"
        style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname.startsWith(tab.path);

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
