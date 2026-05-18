// Contexto de autenticação — gerencia login/logout e estado do usuário
import { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import api from '../api/client';

interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: 'ADMIN' | 'BARBEIRO' | 'CLIENTE';
}

interface AuthContextData {
  usuario: Usuario | null;
  carregando: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Carrega dados salvos ao iniciar
  useEffect(() => {
    const tokenSalvo = localStorage.getItem('@barbearia:token');
    const usuarioSalvo = localStorage.getItem('@barbearia:usuario');

    if (tokenSalvo && usuarioSalvo) {
      try {
        setUsuario(JSON.parse(usuarioSalvo) as Usuario);
      } catch {
        localStorage.removeItem('@barbearia:token');
        localStorage.removeItem('@barbearia:usuario');
      }
    }
    setCarregando(false);
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    const response = await api.post<{ token: string; usuario: Usuario }>('/auth/login', { email, senha });
    const { token, usuario: usr } = response.data;

    localStorage.setItem('@barbearia:token', token);
    localStorage.setItem('@barbearia:usuario', JSON.stringify(usr));
    setUsuario(usr);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('@barbearia:token');
    localStorage.removeItem('@barbearia:usuario');
    setUsuario(null);
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, carregando, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
