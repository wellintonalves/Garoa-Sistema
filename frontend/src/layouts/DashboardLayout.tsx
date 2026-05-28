// Layout principal responsivo
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Menu } from 'lucide-react';

export function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const nomeBarbearia = import.meta.env.VITE_BARBEARIA_NOME || 'GAROA';

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
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
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: '20px',
            letterSpacing: '0.06em',
            color: 'var(--text-primary)',
          }}
        >
          {nomeBarbearia}
        </span>
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
