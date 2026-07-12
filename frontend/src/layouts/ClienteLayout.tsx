// Layout do app do cliente dentro de uma barbearia — menu inferior com 4 abas
import { Outlet, useNavigate, useLocation, useParams, Navigate } from 'react-router-dom';
import { Home, Calendar, Star, User, MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import clienteApi from '../api/clienteApi';
import { useTema } from '../hooks/useTema';
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
        background: 'var(--amber)',
        color: '#000',
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
      <MessageCircle size={22} />
    </button>
  );
}

export function ClienteLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { barbeariaId } = useParams<{ barbeariaId: string }>();
  const [barbearia, setBarbearia] = useState<BarbeariaInfo | null>(null);
  const { cliente, carregando: authCarregando } = useClienteAuth();
  const { carregarTemaCliente, limparTema } = useTema();

  useEffect(() => {
    if (barbeariaId) {
      // Busca dados da barbearia via minhas-barbearias para obter o nome
      clienteApi.get('/cliente/minhas-barbearias').then((res) => {
        const found = res.data.find((b: BarbeariaInfo) => b.id === barbeariaId);
        if (found) {
          setBarbearia(found);
          // Busca identidade visual da barbearia e aplica o tema
          carregarTemaCliente(found.slug);
        }
      }).catch(() => {
        navigate('/cliente/home');
      });
    }
    // Cleanup: ao sair do contexto da barbearia, restaura tema padrão
    return () => { limparTema(); };
  }, [barbeariaId, carregarTemaCliente, limparTema]);

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
    <div className="flex h-[100dvh] overflow-hidden" style={{ background: 'var(--fundo-pagina)', color: 'var(--text-primary)' }}>
      {/* Sidebar Desktop (>= 768px) */}
      <aside className="hidden md:flex flex-col w-[220px] flex-shrink-0" style={{ background: 'var(--fundo-sidebar)', borderRight: '1px solid var(--borda)' }}>
        {/* Header (Letterhead) */}
        <div className="flex flex-col items-center justify-center py-8 border-b" style={{ borderColor: 'var(--borda)' }}>
          <h1 style={{ fontFamily: 'var(--fonte-interface)', fontWeight: 600, fontSize: '14px', letterSpacing: '0.4em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
            {barbearia?.nome || 'BARBEARIA'}
          </h1>
          {barbearia?.createdAt && (
            <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '8px', letterSpacing: '0.4em', color: 'var(--amber)', textTransform: 'uppercase', marginTop: '4px', marginBottom: '12px' }}>
              Desde {new Date(barbearia.createdAt).getFullYear()}
            </p>
          )}
          <div className="flex items-center w-full px-6 gap-2">
            <div className="flex-1 h-px" style={{ background: 'var(--borda)' }} />
            <div style={{ width: '6px', height: '6px', background: 'var(--amber)', transform: 'rotate(45deg)' }} />
            <div className="flex-1 h-px" style={{ background: 'var(--borda)' }} />
          </div>
        </div>

        {/* Navegação Sidebar */}
        <nav className="flex-1 flex flex-col gap-2 p-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location.pathname === tab.path || (tab.path !== basePath && location.pathname.startsWith(tab.path));
            return (
              <button
                key={tab.name}
                onClick={() => navigate(tab.path)}
                className={`nav-item-v2 flex items-center gap-3 p-3 w-full text-left ${isActive ? 'active' : ''}`}
                style={{ padding: '10px 14px' }}
              >
                <Icon size={18} />
                <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', fontWeight: isActive ? 500 : 400 }}>
                  {tab.name}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Rodapé Sidebar (Perfil) */}
        <div className="p-4 border-t" style={{ borderColor: 'var(--borda)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(var(--cor-primaria-rgb), 0.12)', color: 'var(--amber)', fontFamily: 'var(--fonte-interface)', fontSize: '12px', fontWeight: 600 }}>
              {cliente?.nome.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'CL'}
            </div>
            <div className="min-w-0">
              <p className="truncate" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                {cliente?.nome.split(' ')[0]}
              </p>
              <p className="truncate" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-muted)' }}>
                {cliente?.email || 'cliente@barbearia.com'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden relative">
        <div className="flex-1 overflow-y-auto pb-24 md:pb-0">
          <Outlet context={{ barbearia, barbeariaId }} />
        </div>

        {/* Botão flutuante de chat — visível em todas as abas */}
        {location.pathname !== `${basePath}/chat` && (
          <ChatFab onClick={() => navigate(`${basePath}/chat`)} />
        )}

        {/* Bottom Nav Mobile (< 768px) */}
        <nav className="md:hidden flex justify-between items-center z-50 px-2 py-2"
             style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--fundo-sidebar)', borderTop: '1px solid var(--borda)' }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location.pathname === tab.path || (tab.path !== basePath && location.pathname.startsWith(tab.path));
            return (
              <button
                key={tab.name}
                onClick={() => navigate(tab.path)}
                className={`bottom-nav-btn flex flex-col items-center justify-center w-full p-2 transition-all ${isActive ? 'active' : ''}`}
              >
                <Icon size={22} style={{ marginBottom: '4px', opacity: isActive ? 1 : 0.7 }} />
                <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '9px', letterSpacing: '0.08em', fontWeight: isActive ? 600 : 400 }}>
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
