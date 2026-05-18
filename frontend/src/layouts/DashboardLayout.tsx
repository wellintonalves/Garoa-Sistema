// Layout principal com sidebar
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';

export function DashboardLayout() {
  return (
    <div className="min-h-screen bg-[#0c0c0e]">
      <Sidebar />
      {/* Conteúdo principal — margem para a sidebar */}
      <main className="ml-16 lg:ml-60 min-h-screen transition-all duration-300">
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
