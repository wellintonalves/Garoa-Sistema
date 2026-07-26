import { Outlet, useNavigate, useLocation, useParams } from 'react-router-dom';
import { Home, Calendar, Clock, Star, User } from 'lucide-react';
import { useClientAuth } from '../hooks/useClientAuth';
import { useEffect, useState } from 'react';
import { api } from '../api';

export function ClientLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams<{ slug: string }>();
  const { cliente } = useClientAuth();
  const [barbearia, setBarbearia] = useState<any>(null);

  useEffect(() => {
    if (slug) {
      api.get(`/b/${slug}`).then((res) => {
        setBarbearia(res.data);
      }).catch(() => {
        navigate('/login');
      });
    }
  }, [slug]);

  if (!cliente || cliente.barbeariaId !== barbearia?.id) {
    // Pode estar carregando a barbearia ainda
    if (!barbearia) return <div className="h-screen bg-zinc-950 flex items-center justify-center text-orange-500">Carregando...</div>;
  }

  const tabs = [
    { name: 'Início', path: `/b/${slug}/app`, icon: Home },
    { name: 'Agendar', path: `/b/${slug}/app/agendar`, icon: Calendar },
    { name: 'Histórico', path: `/b/${slug}/app/historico`, icon: Clock },
    { name: 'Fidelidade', path: `/b/${slug}/app/fidelidade`, icon: Star },
    { name: 'Perfil', path: `/b/${slug}/app/perfil`, icon: User },
  ];

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden font-sans" style={{ background: 'var(--fundo-pagina)', color: 'var(--texto-principal)' }}>
      <div className="flex-1 overflow-y-auto pb-24">
        <div style={{ maxWidth: '1280px', margin: '0 auto', paddingLeft: 'var(--espaco-5, 1.25rem)', paddingRight: 'var(--espaco-5, 1.25rem)' }}>
          <Outlet context={{ barbearia }} />
        </div>
      </div>

      {/* Bottom Navigation — Seção 7.5/9 */}
      <nav className="bottom-tab-bar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path || (tab.path !== `/b/${slug}/app` && location.pathname.startsWith(tab.path));
          
          return (
            <button
              key={tab.name}
              onClick={() => navigate(tab.path)}
              className={`bottom-tab-item ${isActive ? 'active' : ''}`}
              style={{ textTransform: 'none' }}
            >
              <Icon size={24} style={{ marginBottom: '2px', opacity: isActive ? 1 : 0.7 }} />
              <span className="bottom-tab-label">{tab.name}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
