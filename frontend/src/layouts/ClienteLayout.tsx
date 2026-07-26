// Layout do app do cliente dentro de uma barbearia — menu inferior com 4 abas
import { Outlet, useNavigate, useLocation, useParams, Navigate } from 'react-router-dom';
import { House, CalendarBlank, Gift, User, ChatCircle } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import clienteApi from '../api/clienteApi';
import { useClienteAuth } from '../hooks/useClienteAuth';

interface BarbeariaInfo {
  id: string;
  nome: string;
  slug: string;
  logo: string | null;
  endereco: string | null;
  createdAt: string;
}

/** Botão flutuante de chat — aparece em todas as abas exceto na própria aba de chat */
function ChatFab({ onClick }: { onClick: () => void }) {
  const isMobile = window.innerWidth < 768;
  return (
    <button
      onClick={onClick}
      title="Falar com a barbearia"
      style={{
        position: 'fixed',
        bottom: isMobile ? '76px' : '24px',
        right: '20px',
        zIndex: 60,
        width: '52px',
        height: '52px',
        borderRadius: '50%',
        background: 'var(--cor-primaria)',
        color: 'var(--texto-sobre-primaria)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
    >
      <ChatCircle size={22} weight="regular" />
    </button>
  );
}

export function ClienteLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { barbeariaId } = useParams<{ barbeariaId: string }>();
  const [barbearia, setBarbearia] = useState<BarbeariaInfo | null>(null);
  const { cliente, carregando: authCarregando } = useClienteAuth();
  useEffect(() => {
    if (barbeariaId) {
      // Busca dados da barbearia via minhas-barbearias para obter o nome
      clienteApi.get('/cliente/minhas-barbearias').then((res) => {
        const found = res.data.find((b: BarbeariaInfo) => b.id === barbeariaId);
        if (found) {
          setBarbearia(found);
        }
      }).catch(() => {
        navigate('/cliente/home');
      });
    }
  }, [barbeariaId, navigate]);

  // Route guard — bloqueia acesso sem autenticação de cliente (após todos os hooks)
  if (!authCarregando && !cliente) {
    return <Navigate to="/" replace />;
  }

  const basePath = `/cliente/barbearia/${barbeariaId}`;

  const tabs = [
    { name: 'Início', path: basePath, icon: House },
    { name: 'Agendar', path: `${basePath}/agendar`, icon: CalendarBlank },
    { name: 'Fidelidade', path: `${basePath}/fidelidade`, icon: Gift },
    { name: 'Perfil', path: `${basePath}/perfil`, icon: User },
  ];

  return (
    <div className="flex h-[100dvh] overflow-hidden" style={{ background: 'var(--fundo-pagina)', color: 'var(--text-primary)' }}>
      {/* Sidebar Desktop (>= 768px) — Largura 240px (seção 7.5/9) */}
      <aside className="hidden md:flex flex-col w-[240px] flex-shrink-0" style={{ background: 'var(--fundo-superficie, var(--fundo-sidebar))', borderRight: '1px solid var(--borda-sutil, var(--borda))' }}>
        {/* Header (Letterhead) */}
        <div className="flex flex-col items-center justify-center py-8 border-b" style={{ borderColor: 'var(--borda-sutil, var(--borda))' }}>
          <h1 style={{ fontFamily: 'var(--fonte-interface)', fontWeight: 600, fontSize: '16px', letterSpacing: '0.06em', textTransform: 'none', color: 'var(--text-primary)' }}>
            {barbearia?.nome || 'Barbearia'}
          </h1>
          {barbearia?.createdAt && (
            <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', letterSpacing: '0.02em', color: 'var(--cor-primaria)', textTransform: 'none', marginTop: '4px', marginBottom: '12px' }}>
              Desde {new Date(barbearia.createdAt).getFullYear()}
            </p>
          )}
          <div className="flex items-center w-full px-6 gap-2">
            <div className="flex-1 h-px" style={{ background: 'var(--borda-sutil, var(--borda))' }} />
            <div style={{ width: '6px', height: '6px', background: 'var(--cor-primaria)', transform: 'rotate(45deg)' }} />
            <div className="flex-1 h-px" style={{ background: 'var(--borda-sutil, var(--borda))' }} />
          </div>
        </div>

        {/* Navegação Sidebar — Sem uppercase e sem bordas nos itens */}
        <nav className="flex-1 flex flex-col gap-2 p-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location.pathname === tab.path || (tab.path !== basePath && location.pathname.startsWith(tab.path));
            return (
              <button
                key={tab.name}
                onClick={() => navigate(tab.path)}
                className={`nav-item ${isActive ? 'active' : ''}`}
                style={{ padding: '10px 14px', textTransform: 'none' }}
              >
                <Icon size={20} weight={isActive ? "fill" : "regular"} />
                <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', fontWeight: isActive ? 500 : 400, textTransform: 'none' }}>
                  {tab.name}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Rodapé Sidebar (Perfil) */}
        <div className="p-4 border-t" style={{ borderColor: 'var(--borda-sutil, var(--borda))' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(var(--cor-primaria-rgb), 0.12)', color: 'var(--cor-primaria)', fontFamily: 'var(--fonte-interface)', fontSize: '12px', fontWeight: 600 }}>
              {cliente?.nome.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'CL'}
            </div>
            <div className="min-w-0">
              <p className="truncate" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', textTransform: 'none' }}>
                {cliente?.nome.split(' ')[0]}
              </p>
              <p className="truncate" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--texto-secundario, var(--text-muted))', textTransform: 'none' }}>
                {cliente?.email || 'cliente@barbearia.com'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Conteúdo Principal — Largura máx 1280px com gutter var(--espaco-5) */}
      <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden relative">
        <div className="flex-1 overflow-y-auto pb-24 md:pb-0">
          <div style={{ maxWidth: '1280px', margin: '0 auto', paddingLeft: 'var(--espaco-5, 1.25rem)', paddingRight: 'var(--espaco-5, 1.25rem)' }}>
            <Outlet context={{ barbearia, barbeariaId }} />
          </div>
        </div>

        {/* Botão flutuante de chat — visível em todas as abas */}
        {location.pathname !== `${basePath}/chat` && (
          <ChatFab onClick={() => navigate(`${basePath}/chat`)} />
        )}

        {/* Bottom Nav Mobile (< 768px) — Altura 64px + safe area, ícone 24px + label 11px, alvo 48px */}
        <nav className="md:hidden bottom-tab-bar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location.pathname === tab.path || (tab.path !== basePath && location.pathname.startsWith(tab.path));
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
      </main>
    </div>
  );
}
