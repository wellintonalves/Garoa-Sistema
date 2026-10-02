import { createContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../api';
import { useSessaoRemota, FalhaSessao } from '../lib/auth/useSessaoRemota';

interface UsuarioCliente {
  id: string;
  nome: string;
  email: string;
  barbeariaId: string;
}

interface ClientAuthContextData {
  cliente: UsuarioCliente | null;
  slugAtual: string | null;
  carregando: boolean;
  entrar: (slug: string, dados: UsuarioCliente) => void;
  sair: () => void;
}

export const ClientAuthContext = createContext<ClientAuthContextData>({} as ClientAuthContextData);

export function ClientAuthProvider({ children }: { children: ReactNode }) {
  const sessao = useSessaoRemota<UsuarioCliente>(api, '/b/auth', 'usuario', 'tenant');
  const { dados: cliente, setDados: setCliente, carregando, logout: sair } = sessao;
  const [slugAtual, setSlugAtual] = useState<string | null>(null);
  useEffect(() => { setSlugAtual(window.location.pathname.match(/^\/b\/([^/]+)/)?.[1] ?? null); }, [cliente]);
  const entrar = (slug: string, dados: UsuarioCliente) => { setSlugAtual(slug); setCliente(dados); };

  return (
    <ClientAuthContext.Provider value={{ cliente, slugAtual, carregando, entrar, sair }}>
      <FalhaSessao {...sessao} portal="tenant">{children}</FalhaSessao>
    </ClientAuthContext.Provider>
  );
}
