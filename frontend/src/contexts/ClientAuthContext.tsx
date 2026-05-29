import { createContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../api';

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
  entrar: (slug: string, token: string, dados: UsuarioCliente) => void;
  sair: () => void;
}

export const ClientAuthContext = createContext<ClientAuthContextData>({} as ClientAuthContextData);

export function ClientAuthProvider({ children }: { children: ReactNode }) {
  const [cliente, setCliente] = useState<UsuarioCliente | null>(null);
  const [slugAtual, setSlugAtual] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    // Recupera do localStorage procurando qualquer chave @Garoa:client_token_*
    const keys = Object.keys(localStorage);
    const tokenKey = keys.find(k => k.startsWith('@Garoa:client_token_'));
    
    if (tokenKey) {
      const slug = tokenKey.split('_').pop();
      const token = localStorage.getItem(tokenKey);
      const userStr = localStorage.getItem(`@Garoa:client_user_${slug}`);
      
      if (token && userStr && slug) {
        setSlugAtual(slug);
        setCliente(JSON.parse(userStr));
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
    }
    setCarregando(false);
  }, []);

  const entrar = (slug: string, token: string, dados: UsuarioCliente) => {
    localStorage.setItem(`@Garoa:client_token_${slug}`, token);
    localStorage.setItem(`@Garoa:client_user_${slug}`, JSON.stringify(dados));
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setSlugAtual(slug);
    setCliente(dados);
  };

  const sair = () => {
    if (slugAtual) {
      localStorage.removeItem(`@Garoa:client_token_${slugAtual}`);
      localStorage.removeItem(`@Garoa:client_user_${slugAtual}`);
    }
    setCliente(null);
    setSlugAtual(null);
    delete api.defaults.headers.common['Authorization'];
  };

  return (
    <ClientAuthContext.Provider value={{ cliente, slugAtual, carregando, entrar, sair }}>
      {children}
    </ClientAuthContext.Provider>
  );
}
