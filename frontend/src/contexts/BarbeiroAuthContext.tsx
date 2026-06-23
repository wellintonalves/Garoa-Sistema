// Contexto de autenticação do barbeiro — gerencia login/logout isolado do admin
import { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import barbeiroApi from '../api/barbeiroApi';

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
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
}

export const BarbeiroAuthContext = createContext<BarbeiroAuthContextData>({} as BarbeiroAuthContextData);

export function BarbeiroAuthProvider({ children }: { children: ReactNode }) {
  const [barbeiro, setBarbeiro] = useState<DadosBarbeiro | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const tokenSalvo = localStorage.getItem('@garoa:barbeiro_token');
    const dadosSalvos = localStorage.getItem('@garoa:barbeiro_dados');

    if (tokenSalvo && dadosSalvos) {
      try {
        setBarbeiro(JSON.parse(dadosSalvos) as DadosBarbeiro);
      } catch {
        localStorage.removeItem('@garoa:barbeiro_token');
        localStorage.removeItem('@garoa:barbeiro_dados');
      }
    }
    setCarregando(false);
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    const response = await barbeiroApi.post<{ token: string; barbeiro: DadosBarbeiro }>('/barbeiro/login', { email, senha });
    const { token, barbeiro: dados } = response.data;

    localStorage.setItem('@garoa:barbeiro_token', token);
    localStorage.setItem('@garoa:barbeiro_dados', JSON.stringify(dados));
    setBarbeiro(dados);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('@garoa:barbeiro_token');
    localStorage.removeItem('@garoa:barbeiro_dados');
    setBarbeiro(null);
    window.location.href = '/barbeiro/login';
  }, []);

  return (
    <BarbeiroAuthContext.Provider value={{ barbeiro, carregando, login, logout }}>
      {children}
    </BarbeiroAuthContext.Provider>
  );
}
