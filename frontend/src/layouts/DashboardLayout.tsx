// Layout principal com sidebar — design system industrial
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';

export function DashboardLayout() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar />
      {/* Conteúdo principal — margem fixa de 220px (largura da sidebar) */}
      <main className="min-h-screen transition-all duration-300" style={{ marginLeft: '220px' }}>
        <div style={{ padding: '1.5rem', maxWidth: '1280px', margin: '0 auto' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
