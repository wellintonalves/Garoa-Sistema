// Contexto de autenticação do cliente — gerencia login/logout isolado do admin
import { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import clienteApi from '../api/clienteApi';
import { tokenEstaValido } from '../lib/auth/tokenValido';
import { limparSessao } from '../lib/auth/limparSessao';

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
  registrar: (nome: string, email: string, senha: string, telefone: string, barbeariaId?: string, codigoIndicacao?: string) => Promise<{ usuarioId: string }>;
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
      if (tokenEstaValido(tokenSalvo)) {
        try {
          setCliente(JSON.parse(dadosSalvos) as DadosCliente);
        } catch {
          limparSessao();
        }
      } else {
        limparSessao();
      }
    }
    setCarregando(false);
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    try {
      const response = await clienteApi.post<{ token: string; cliente: DadosCliente }>('/cliente/login', { email, senha });
      const { token, cliente: dados } = response.data;

      localStorage.setItem('@garoa:cliente_token', token);
      localStorage.setItem('@garoa:cliente_dados', JSON.stringify(dados));
      setCliente(dados);
    } catch (error: any) {
      if (error.response?.status === 403 && error.response?.data?.emailNaoVerificado) {
        window.location.href = '/verificar-email';
        throw new Error('Redirecionando para verificação de email...');
      }
      throw error;
    }
  }, []);

  const registrar = useCallback(async (nome: string, email: string, senha: string, telefone: string, barbeariaId?: string, codigoIndicacao?: string) => {
    const response = await clienteApi.post<{ mensagem: string; usuarioId: string }>('/cliente/register', {
      nome, email, senha, telefone, barbeariaId, codigoIndicacao

    });
    
    return { usuarioId: response.data.usuarioId };
  }, []);

  const logout = useCallback(() => {
    limparSessao();
    setCliente(null);
    window.location.href = '/';
  }, []);

  return (
    <ClienteAuthContext.Provider value={{ cliente, carregando, login, registrar, logout }}>
      {children}
    </ClienteAuthContext.Provider>
  );
}
