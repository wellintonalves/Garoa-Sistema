// Contexto de autenticação do barbeiro — gerencia login/logout isolado do admin
import { createContext, ReactNode, useCallback } from 'react';
import barbeiroApi from '../api/barbeiroApi';
import { useSessaoRemota, FalhaSessao } from '../lib/auth/useSessaoRemota';

interface DadosBarbeiro {
  barbeiroId: string;
  usuarioId: string;
  barbeariaId: string;
  nome: string;
  email: string;
}

interface BarbeiroAuthContextData {
  barbeiro: DadosBarbeiro | null;
  carregando: boolean;
  login: (email: string, senha: string, barbeariaId?: string) => Promise<void>;
  logout: () => void;
  atualizarNome: (nome: string) => void;
}

export const BarbeiroAuthContext = createContext<BarbeiroAuthContextData>({} as BarbeiroAuthContextData);

export function BarbeiroAuthProvider({ children }: { children: ReactNode }) {
  const sessao = useSessaoRemota<DadosBarbeiro>(barbeiroApi, '/barbeiro', 'barbeiro', 'barbeiro');
  const { dados: barbeiro, setDados: setBarbeiro, carregando, logout } = sessao;

  const login = useCallback(async (email: string, senha: string, barbeariaId?: string) => {
    const response = await barbeiroApi.post<{ barbeiro: DadosBarbeiro }>('/barbeiro/login', { email, senha, barbeariaId });
    const { barbeiro: dados } = response.data;

    setBarbeiro(dados);
  }, []);

  const atualizarNome = useCallback((nome: string) => {
    setBarbeiro(atual => {
      if (!atual) return atual;
      const atualizado = { ...atual, nome };
      return atualizado;
    });
  }, []);

  return (
    <BarbeiroAuthContext.Provider value={{ barbeiro, carregando, login, logout, atualizarNome }}>
      <FalhaSessao {...sessao} portal="barbeiro">{children}</FalhaSessao>
    </BarbeiroAuthContext.Provider>
  );
}
