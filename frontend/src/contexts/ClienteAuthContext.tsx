// Contexto de autenticação do cliente — gerencia login/logout isolado do admin
import { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import clienteApi from '../api/clienteApi';

interface DadosCliente {
  clienteId: string;
  usuarioId: string;
  nome: string;
  email: string;
}

interface ClienteAuthContextData {
  cliente: DadosCliente | null;
  carregando: boolean;
  login: (email: string, senha: string) => Promise<void>;
  registrar: (nome: string, email: string, senha: string, telefone: string) => Promise<void>;
  logout: () => void;
}

export const ClienteAuthContext = createContext<ClienteAuthContextData>({} as ClienteAuthContextData);

export function ClienteAuthProvider({ children }: { children: ReactNode }) {
  const [cliente, setCliente] = useState<DadosCliente | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const tokenSalvo = localStorage.getItem('@garoa:cliente_token');
    const dadosSalvos = localStorage.getItem('@garoa:cliente_dados');

    if (tokenSalvo && dadosSalvos) {
      try {
        setCliente(JSON.parse(dadosSalvos) as DadosCliente);
      } catch {
        localStorage.removeItem('@garoa:cliente_token');
        localStorage.removeItem('@garoa:cliente_dados');
      }
    }
    setCarregando(false);
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    const response = await clienteApi.post<{ token: string; cliente: DadosCliente }>('/cliente/login', { email, senha });
    const { token, cliente: dados } = response.data;

    localStorage.setItem('@garoa:cliente_token', token);
    localStorage.setItem('@garoa:cliente_dados', JSON.stringify(dados));
    setCliente(dados);
  }, []);

  const registrar = useCallback(async (nome: string, email: string, senha: string, telefone: string) => {
    const response = await clienteApi.post<{ token: string; cliente: DadosCliente }>('/cliente/register', {
      nome, email, senha, telefone,
    });
    const { token, cliente: dados } = response.data;

    localStorage.setItem('@garoa:cliente_token', token);
    localStorage.setItem('@garoa:cliente_dados', JSON.stringify(dados));
    setCliente(dados);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('@garoa:cliente_token');
    localStorage.removeItem('@garoa:cliente_dados');
    setCliente(null);
  }, []);

  return (
    <ClienteAuthContext.Provider value={{ cliente, carregando, login, registrar, logout }}>
      {children}
    </ClienteAuthContext.Provider>
  );
}
