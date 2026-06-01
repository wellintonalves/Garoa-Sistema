// Hook para acessar o contexto de autenticação do barbeiro
import { useContext } from 'react';
import { BarbeiroAuthContext } from '../contexts/BarbeiroAuthContext';

export function useBarbeiroAuth() {
  const context = useContext(BarbeiroAuthContext);
  if (!context || Object.keys(context).length === 0) {
    throw new Error('useBarbeiroAuth deve ser usado dentro de BarbeiroAuthProvider');
  }
  return context;
}
