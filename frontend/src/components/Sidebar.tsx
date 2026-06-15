// Sidebar — menu lateral com estética industrial responsivo
import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Scissors, ListChecks,
  Users, DollarSign, Package, ChevronLeft, ChevronRight, LogOut,
  BarChart3, X, Settings
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import api from '../api/client';
import { ToggleModo } from './ToggleModo';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const menuItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/agenda', label: 'Agenda', icon: Calendar },
  { path: '/admin/barbeiros', label: 'Barbeiros', icon: Scissors },
  { path: '/admin/servicos', label: 'Serviços', icon: ListChecks },
  { path: '/admin/clientes', label: 'Clientes', icon: Users },
  { path: '/admin/financeiro', label: 'Financeiro', icon: DollarSign },
  { path: '/admin/relatorios', label: 'Relatórios', icon: BarChart3 },
  { path: '/admin/estoque', label: 'Estoque', icon: Package },
  { path: '/admin/configuracoes', label: 'Configurações', icon: Settings },
];

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const [recolhido, setRecolhido] = useState(false);
  const { usuario, logout } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [nomeDaBarbearia, setNomeDaBarbearia] = useState<string>(import.meta.env.VITE_BARBEARIA_NOME || 'GAROA');

  useEffect(() => {
    if (usuario) {
      api.get('/configuracoes/minha-barbearia').then(res => {
        if (res.data.logo) setLogoUrl(res.data.logo);
        if (res.data.nome) setNomeDaBarbearia(res.data.nome);
      }).catch(() => {});
    }
  }, [usuario]);

  return (
    <>
      {/* Overlay Mobile */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden" 
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 flex flex-col z-50 transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
        style={{
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border)',
          width: recolhido ? '64px' : '220px',
        }}
      >
        {/* Logo / Título */}
        <div
          className="flex items-center justify-between h-16 px-5"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          {!recolhido ? (
            logoUrl ? (
              <img src={logoUrl} alt="Logo da Barbearia" className="object-contain" style={{ maxHeight: '48px', maxWidth: '160px' }} />
            ) : (
              <span
                className="animate-fade-in truncate"
                style={{
                  fontFamily: "var(--fonte-interface)",
                  fontSize: '24px',
                  letterSpacing: '0.06em',
                  color: 'var(--text-primary)',
                }}
              >
                {nomeDaBarbearia}
              </span>
            )
          ) : (
            <span
              style={{
                fontFamily: "var(--fonte-interface)",
                fontSize: '20px',
                color: 'var(--cor-icone)',
              }}
            >
              G
            </span>
          )}
          
          {/* Close Mobile */}
          <button 
            className="md:hidden p-1 text-muted"
            onClick={onCloseMobile}
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {menuItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => {
                // Ao clicar no mobile, fecha o menu
                if (window.innerWidth < 768) {
                  onCloseMobile();
                }
              }}
              end={path === '/admin'}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
            >
              <Icon size={16} strokeWidth={1.5} className="flex-shrink-0" />
              {!recolhido && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {!recolhido && <ToggleModo />}

        {/* Usuário + Logout */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px' }}>
          {!recolhido && usuario && (
            <div className="mb-2 px-3">
              <p
                className="truncate"
                style={{
                  fontFamily: 'var(--fonte-interface)',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                }}
              >
                {usuario.nome}
              </p>
              <p
                className="truncate"
                style={{
                  fontFamily: 'var(--fonte-numeros)',
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.04em',
                }}
              >
                {usuario.email}
              </p>
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2 transition-colors"
            style={{
              fontFamily: 'var(--fonte-numeros)',
              fontSize: '10px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              borderRadius: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--error-text)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <LogOut size={16} strokeWidth={1.5} className="flex-shrink-0" />
            {!recolhido && <span>Sair</span>}
          </button>
        </div>

        {/* Botão recolher (só exibe no desktop) */}
        <button
          onClick={() => setRecolhido(!recolhido)}
          className="hidden md:flex absolute -right-3 top-20 w-6 h-6 items-center justify-center transition-colors"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
            borderRadius: 0,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          {recolhido ? <ChevronRight size={12} strokeWidth={1.5} /> : <ChevronLeft size={12} strokeWidth={1.5} />}
        </button>
      </aside>
    </>
  );
}
