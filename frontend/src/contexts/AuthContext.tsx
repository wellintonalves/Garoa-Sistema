// Contexto de autenticação — gerencia login/logout e estado do usuário
import { createContext, ReactNode, useCallback } from 'react';
import api from '../api/client';
import { useSessaoRemota, FalhaSessao } from '../lib/auth/useSessaoRemota';

interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: 'ADMIN' | 'BARBEIRO' | 'CLIENTE';
  barbeariaId?: string | null;
}

interface AuthContextData {
  usuario: Usuario | null;
  carregando: boolean;
  login: (email: string, senha: string) => Promise<void>;
  loginDireto: (usr: Usuario) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: ReactNode }) {
  const sessao = useSessaoRemota<Usuario>(api, '/auth', 'usuario', 'admin');
  const { dados: usuario, setDados: setUsuario, carregando, logout } = sessao;

  const login = useCallback(async (email: string, senha: string) => {
    const response = await api.post<{ usuario: Usuario }>('/auth/login', { email, senha });
    const { usuario: usr } = response.data;

    setUsuario(usr);
  }, []);

  const loginDireto = useCallback((usr: Usuario) => {
    setUsuario(usr);
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, carregando, login, loginDireto, logout }}>
      <FalhaSessao {...sessao} portal="admin">{children}</FalhaSessao>
    </AuthContext.Provider>
  );
}
