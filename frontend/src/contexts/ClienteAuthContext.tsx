// Contexto de autenticação do cliente — gerencia login/logout isolado do admin
import { createContext, ReactNode, useCallback } from 'react';
import clienteApi from '../api/clienteApi';
import { useSessaoRemota, FalhaSessao } from '../lib/auth/useSessaoRemota';

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
  registrar: (nome: string, email: string, senha: string, telefone: string, dataNascimento: string, aceiteDocumentos: { aceito: boolean; termosVersao: string; privacidadeVersao: string }, barbeariaId?: string, codigoIndicacao?: string) => Promise<{ usuarioId: string }>;
  logout: () => void;
}

export const ClienteAuthContext = createContext<ClienteAuthContextData>({} as ClienteAuthContextData);

export function ClienteAuthProvider({ children }: { children: ReactNode }) {
  const sessao = useSessaoRemota<DadosCliente>(clienteApi, '/cliente', 'cliente', 'cliente');
  const { dados: cliente, setDados: setCliente, carregando, logout } = sessao;

  const login = useCallback(async (email: string, senha: string) => {
    const response = await clienteApi.post<{ cliente: DadosCliente }>('/cliente/login', { email, senha });
    setCliente(response.data.cliente);
  }, []);

  const registrar = useCallback(async (nome: string, email: string, senha: string, telefone: string, dataNascimento: string, aceiteDocumentos: { aceito: boolean; termosVersao: string; privacidadeVersao: string }, barbeariaId?: string, codigoIndicacao?: string) => {
    const response = await clienteApi.post<{ mensagem: string; usuarioId: string }>('/cliente/register', {
      nome, email: email.trim().toLowerCase(), senha, telefone, dataNascimento, aceiteDocumentos, barbeariaId, codigoIndicacao

    });
    
    return { usuarioId: response.data.usuarioId };
  }, []);

  return (
    <ClienteAuthContext.Provider value={{ cliente, carregando, login, registrar, logout }}>
      <FalhaSessao {...sessao} portal="cliente">{children}</FalhaSessao>
    </ClienteAuthContext.Provider>
  );
}
