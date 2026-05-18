// Sidebar — menu lateral recolhível com ícones e labels
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Scissors, ListChecks,
  Users, DollarSign, Package, ChevronLeft, ChevronRight, LogOut,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const menuItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/agenda', label: 'Agenda', icon: Calendar },
  { path: '/barbeiros', label: 'Barbeiros', icon: Scissors },
  { path: '/servicos', label: 'Serviços', icon: ListChecks },
  { path: '/clientes', label: 'Clientes', icon: Users },
  { path: '/financeiro', label: 'Financeiro', icon: DollarSign },
  { path: '/estoque', label: 'Estoque', icon: Package },
];

export function Sidebar() {
  const [recolhido, setRecolhido] = useState(false);
  const { usuario, logout } = useAuth();

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-neutral-900 border-r border-neutral-800 flex flex-col transition-all duration-300 z-50 ${
        recolhido ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo / Título */}
      <div className="flex items-center h-16 px-4 border-b border-neutral-800">
        <img src="/logo-garoa.png" alt="Garoa Logo" className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-cyan-500/20" />
        {!recolhido && (
          <span className="ml-3 text-sm font-bold text-white truncate animate-fade-in">
            {import.meta.env.VITE_BARBEARIA_NOME || 'Garoa Barbearia'}
          </span>
        )}
      </div>

      {/* Menu */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {menuItems.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-400'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`
            }
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {!recolhido && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Usuário + Logout */}
      <div className="border-t border-neutral-800 p-3">
        {!recolhido && usuario && (
          <div className="mb-2 px-2">
            <p className="text-xs font-medium text-white truncate">{usuario.nome}</p>
            <p className="text-xs text-neutral-500 truncate">{usuario.email}</p>
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!recolhido && <span>Sair</span>}
        </button>
      </div>

      {/* Botão recolher */}
      <button
        onClick={() => setRecolhido(!recolhido)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
      >
        {recolhido ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  );
}
