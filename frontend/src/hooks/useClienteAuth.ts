// Hook para acessar o contexto de autenticação do cliente
import { useContext } from 'react';
import { ClienteAuthContext } from '../contexts/ClienteAuthContext';

export function useClienteAuth() {
  const context = useContext(ClienteAuthContext);
  if (!context || Object.keys(context).length === 0) {
    throw new Error('useClienteAuth deve ser usado dentro de ClienteAuthProvider');
  }
  return context;
}
