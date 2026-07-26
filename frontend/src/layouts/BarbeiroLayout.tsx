// Layout do app do barbeiro com navegação inferior
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Clock, Calendar, CurrencyDollar, User } from '@phosphor-icons/react';
import { useBarbeiroAuth } from '../hooks/useBarbeiroAuth';
import { AprovacoesPopup } from '../components/AprovacoesPopup';

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
    { name: 'Comissões', path: '/barbeiro/comissoes', icon: CurrencyDollar },
    { name: 'Perfil', path: '/barbeiro/perfil', icon: User },
  ];

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--fundo-pagina)', color: 'var(--text-primary)' }}>
      <AprovacoesPopup />
      <div className="flex-1 overflow-y-auto pb-24">
        <div style={{ maxWidth: '1280px', margin: '0 auto', paddingLeft: 'var(--espaco-5, 1.25rem)', paddingRight: 'var(--espaco-5, 1.25rem)' }}>
          <Outlet context={{ barbeiro }} />
        </div>
      </div>

      {/* Bottom Navigation — Seção 7.5/9 (64px + safe area, alvo 48px, ícone 24px, label var(--texto-detalhe, 13px), sem uppercase) */}
      <nav className="bottom-tab-bar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname.startsWith(tab.path);

          return (
            <button
              key={tab.name}
              onClick={() => navigate(tab.path)}
              className={`bottom-tab-item ${isActive ? 'active' : ''}`}
              style={{ textTransform: 'none' }}
            >
              <Icon size={24} weight={isActive ? "fill" : "regular"} style={{ marginBottom: '2px', opacity: isActive ? 1 : 0.7 }} aria-hidden="true" />
              <span className="bottom-tab-label">
                {tab.name}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
