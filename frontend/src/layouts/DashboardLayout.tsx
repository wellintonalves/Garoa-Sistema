// Layout principal responsivo
import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Menu } from 'lucide-react';
import api from '../api/client';
import { useTema } from '../hooks/useTema';

export function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [nomeDaBarbearia, setNomeDaBarbearia] = useState<string>(import.meta.env.VITE_BARBEARIA_NOME || 'GAROA');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const { carregarTemaAdmin } = useTema();

  useEffect(() => {
    carregarTemaAdmin();
    api.get('/configuracoes/minha-barbearia').then(res => {
      if (res.data.nome) setNomeDaBarbearia(res.data.nome);
      if (res.data.logo) setLogoUrl(res.data.logo);
    }).catch(() => {});
  }, [carregarTemaAdmin]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--fundo-pagina)' }}>
      {/* Topbar Mobile */}
      <header 
        className="md:hidden flex items-center h-16 px-4 sticky top-0 z-30"
        style={{ 
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)' 
        }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="mr-3 p-1 transition-colors"
          style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none' }}
        >
          <Menu size={20} strokeWidth={1.5} />
        </button>
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-8 object-contain" />
        ) : (
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: '20px',
              letterSpacing: '0.06em',
              color: 'var(--text-primary)',
            }}
          >
            {nomeDaBarbearia}
          </span>
        )}
      </header>

      {/* Sidebar (Controla seu próprio mobile/desktop view) */}
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      
      {/* Conteúdo principal */}
      <main 
        className="min-h-screen transition-all duration-300 md:ml-[220px]" 
      >
        <div 
          className="p-4 md:p-6" 
          style={{ maxWidth: '1280px', margin: '0 auto' }}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}
