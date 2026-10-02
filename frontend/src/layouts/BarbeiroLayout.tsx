import { NavLink, Outlet, Navigate, useLocation } from "react-router-dom";
import { Clock, Calendar, Wallet, User } from "@phosphor-icons/react";
import { useBarbeiroAuth } from "../hooks/useBarbeiroAuth";
import { AprovacoesPopup } from "../components/AprovacoesPopup";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { Brand, Loading, Notice } from "../components/barbeiro/ui";
import { AssistenteIa } from "../components/AssistenteIa";
import barbeiroApi from "../api/barbeiroApi";
export function BarbeiroLayout() {
  const { barbeiro, carregando } = useBarbeiroAuth();
  const location = useLocation();
  if (carregando)
    return (
      <div className="bb-shell">
        <Loading />
      </div>
    );
  if (!barbeiro) return <Navigate to="/barbeiro/login" replace />;
  if (location.pathname === "/barbeiro" || location.pathname === "/barbeiro/")
    return <Navigate to="/barbeiro/hoje" replace />;
  const tabs = [
    { name: "Hoje", path: "hoje", icon: Clock },
    { name: "Agenda", path: "agenda", icon: Calendar },
    { name: "Comissões", path: "comissoes", icon: Wallet },
    { name: "Perfil", path: "perfil", icon: User },
  ];
  return (
    <div
      className="bb-shell"
      onClickCapture={(event) => {
        // WebKit does not focus pointer-activated buttons by default. Preserve
        // a real opener so dialog cancellation returns focus consistently.
        (event.target as HTMLElement).closest<HTMLButtonElement>("button")?.focus();
      }}
    >
      <a href="#barber-main" className="bb-skip btn-base btn-secundario">
        Ir para o conteúdo
      </a>
      <aside className="bb-sidebar">
        <Brand />
        <p className="bb-sidebar-label">Área do barbeiro</p>
        <nav className="bb-nav" aria-label="Área do barbeiro">
          {tabs.map(({ name, path, icon: Icon }) => (
            <NavLink key={path} to={`/barbeiro/${path}`}>
              <Icon size={22} aria-hidden />
              <span>{name}</span>
            </NavLink>
          ))}
        </nav>
        <div className="bb-account">
          <div className="bb-avatar" aria-hidden>
            {barbeiro.nome.slice(0, 1)}
          </div>
          <div>
            <strong>{barbeiro.nome}</strong>
            <small>Profissional</small>
          </div>
        </div>
      </aside>
      <main className="bb-main" id="barber-main" tabIndex={-1}>
        <div className="bb-mobile-brand">
          <Brand />
        </div>
        <AssistenteIa
          key={`${barbeiro.usuarioId}:${barbeiro.barbeariaId}`}
          identidade={`${barbeiro.usuarioId}:${barbeiro.barbeariaId}`}
          api={barbeiroApi}
          caminho="/ia/barbeiro"
          posicao="navegacao"
        />
        <ErrorBoundary
          key={location.pathname}
          fallback={
            <Notice error onRetry={() => window.location.reload()}>
              Não foi possível exibir esta tela.
            </Notice>
          }
        >
          <AprovacoesPopup />
          <Outlet context={{ barbeiro }} />
        </ErrorBoundary>
      </main>
    </div>
  );
}
