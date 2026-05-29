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
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 font-sans">
      <div className="flex-1 overflow-y-auto pb-20">
        <Outlet context={{ barbearia }} />
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-zinc-900 border-t border-zinc-800 px-2 py-2 flex justify-between items-center z-50">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path || (tab.path !== `/b/${slug}/app` && location.pathname.startsWith(tab.path));
          
          return (
            <button
              key={tab.name}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center w-full p-2 rounded-xl transition-all ${
                isActive ? 'text-orange-500' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon size={24} className={isActive ? 'mb-1' : 'mb-1 opacity-80'} />
              <span className="text-[10px] font-medium">{tab.name}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
