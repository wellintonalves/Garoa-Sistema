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
    <div className="flex h-[100dvh] overflow-hidden" style={{ background: 'var(--fundo-pagina)', color: 'var(--text-primary)' }}>
      <AprovacoesPopup />
      
      {/* Sidebar Desktop (>= 768px) */}
      <aside className="hidden md:flex flex-col w-[240px] flex-shrink-0" style={{ background: 'var(--fundo-superficie, var(--fundo-sidebar))', borderRight: '1px solid var(--borda-sutil, var(--borda))' }}>
        <div className="flex flex-col items-center justify-center py-8 border-b" style={{ borderColor: 'var(--borda-sutil, var(--borda))' }}>
          <h1 style={{ fontFamily: 'var(--fonte-interface)', fontWeight: 600, fontSize: '16px', letterSpacing: '0.06em', textTransform: 'none', color: 'var(--text-primary)' }}>
            Painel do Barbeiro
          </h1>
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--texto-secundario)', marginTop: '4px' }}>
            {barbeiro?.nome}
          </p>
        </div>

        <nav className="flex-1 flex flex-col gap-2 p-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location.pathname.startsWith(tab.path);
            return (
              <button
                key={tab.name}
                onClick={() => navigate(tab.path)}
                className={`nav-item ${isActive ? 'active' : ''}`}
                style={{ padding: '10px 14px', textTransform: 'none', display: 'flex', alignItems: 'center', gap: '12px', borderRadius: '8px', width: '100%', textAlign: 'left', background: isActive ? 'var(--cor-primaria-fundo, rgba(0,0,0,0.05))' : 'transparent', color: isActive ? 'var(--cor-primaria)' : 'var(--text-secondary)' }}
              >
                <Icon size={20} weight={isActive ? "fill" : "regular"} />
                <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', fontWeight: isActive ? 500 : 400 }}>
                  {tab.name}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-y-auto relative pb-[76px] md:pb-0">
        <div style={{ maxWidth: '1280px', width: '100%', margin: '0 auto', paddingLeft: 'var(--espaco-5, 1.25rem)', paddingRight: 'var(--espaco-5, 1.25rem)' }}>
          <Outlet context={{ barbeiro }} />
        </div>
      </div>

      {/* Bottom Navigation — Mobile apenas */}
      <nav className="md:hidden bottom-tab-bar">
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
