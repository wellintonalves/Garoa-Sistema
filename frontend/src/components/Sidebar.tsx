// Sidebar — menu lateral com estética industrial responsivo e Design System v2
import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  SquaresFour, Calendar, Scissors, Package,
  Users, UserCheck, Wallet, CaretLeft, CaretRight, SignOut,
  ChartBar, X, Gear, ChatCircle, Gift
} from '@phosphor-icons/react';
import { useAuth } from '../hooks/useAuth';
import api from '../api/client';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const menuItems = [
  { path: '/admin', label: 'Dashboard', icon: SquaresFour },
  { path: '/admin/agenda', label: 'Agenda', icon: Calendar },
  { path: '/admin/barbeiros', label: 'Barbeiros', icon: Users },
  { path: '/admin/servicos', label: 'Serviços', icon: Scissors },
  { path: '/admin/clientes', label: 'Clientes', icon: UserCheck },
  { path: '/admin/financeiro', label: 'Financeiro', icon: Wallet },
  { path: '/admin/relatorios', label: 'Relatórios', icon: ChartBar },
  { path: '/admin/vendas', label: 'Estoque', icon: Package },
  { path: '/admin/fidelidade', label: 'Fidelidade', icon: Gift },
  { path: '/admin/chat', label: 'Chat', icon: ChatCircle },
  { path: '/admin/configuracoes', label: 'Configurações', icon: Gear },
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
          className="fixed inset-0 bg-[var(--superficie)] z-40 md:hidden" 
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container — Largura 240px no desktop e fundo --fundo-superficie (seção 7.5 e 9) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 flex flex-col z-50 transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
        style={{
          background: 'var(--fundo-superficie, var(--bg-surface))',
          borderRight: '1px solid var(--borda-sutil, var(--border))',
          width: recolhido ? '64px' : '240px',
        }}
      >
        {/* Logo / Título */}
        <div
          className="flex items-center justify-between h-16 px-5"
          style={{ borderBottom: '1px solid var(--borda-sutil, var(--border))' }}
        >
          {!recolhido ? (
            logoUrl ? (
              <img src={logoUrl} alt="Logo da Barbearia" className="object-contain" style={{ maxHeight: '48px', maxWidth: '160px' }} />
            ) : (
              <span
                className="animate-fade-in truncate"
                style={{
                  fontFamily: "var(--fonte-interface, var(--fonte-sans))",
                  fontSize: '22px',
                  fontWeight: 600,
                  color: 'var(--texto-principal, var(--text-primary))',
                  textTransform: 'none',
                }}
              >
                {nomeDaBarbearia}
              </span>
            )
          ) : (
            <span
              style={{
                fontFamily: "var(--fonte-interface, var(--fonte-sans))",
                fontSize: '20px',
                fontWeight: 600,
                color: 'var(--cor-primaria)',
              }}
            >
              G
            </span>
          )}
          
          {/* Close Mobile */}
          <button 
            className="md:hidden p-1 text-muted min-h-[48px] min-w-[48px] flex items-center justify-center"
            onClick={onCloseMobile}
            style={{ color: 'var(--texto-secundario, var(--text-muted))', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Menu — Sem borda nos itens, ícones Lucide outline 20px, peso 500 ativo + 3px barra */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {menuItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => {
                if (window.innerWidth < 768) {
                  onCloseMobile();
                }
              }}
              end={path === '/admin'}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
              style={{
                textTransform: 'none',
              }}
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} weight={isActive ? "bold" : "regular"} className="flex-shrink-0" />
                  {!recolhido && <span className="truncate" style={{ textTransform: 'none' }}>{label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Usuário + Logout (Sem uppercase na navegação) */}
        <div style={{ borderTop: '1px solid var(--borda-sutil, var(--border))', padding: '12px' }}>
          {!recolhido && usuario && (
            <div className="mb-2 px-3">
              <p
                className="truncate"
                style={{
                  fontFamily: 'var(--fonte-interface, var(--fonte-sans))',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--texto-principal, var(--text-primary))',
                  textTransform: 'none',
                }}
              >
                {usuario.nome}
              </p>
              <p
                className="truncate"
                style={{
                  fontFamily: 'var(--fonte-interface, var(--fonte-sans))',
                  fontSize: '11px',
                  color: 'var(--texto-secundario, var(--text-muted))',
                  textTransform: 'none',
                }}
              >
                {usuario.email}
              </p>
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2 transition-colors max-md:min-h-[48px]"
            style={{
              fontFamily: 'var(--fonte-interface, var(--fonte-sans))',
              fontSize: '13px',
              fontWeight: 400,
              textTransform: 'none',
              color: 'var(--texto-secundario, var(--text-muted))',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              borderRadius: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--erro, var(--error-text))'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--texto-secundario, var(--text-muted))'; }}
          >
            <SignOut size={20} className="flex-shrink-0" />
            {!recolhido && <span style={{ textTransform: 'none' }}>Sair</span>}
          </button>
        </div>

        {/* Botão recolher (só exibe no desktop) */}
        <button
          onClick={() => setRecolhido(!recolhido)}
          className="hidden md:flex absolute -right-3 top-20 w-6 h-6 items-center justify-center transition-colors"
          style={{
            background: 'var(--fundo-superficie, var(--bg-surface))',
            border: '1px solid var(--borda-sutil, var(--border))',
            color: 'var(--texto-secundario, var(--text-muted))',
            borderRadius: '0px',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--texto-principal, var(--text-primary))'; e.currentTarget.style.borderColor = 'var(--cor-primaria)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--texto-secundario, var(--text-muted))'; e.currentTarget.style.borderColor = 'var(--borda-sutil, var(--border))'; }}
        >
          {recolhido ? <CaretRight size={14} /> : <CaretLeft size={14} />}
        </button>
      </aside>
    </>
  );
}
