import { useContext } from 'react';
import { ClientAuthContext } from '../contexts/ClientAuthContext';

export function useClientAuth() {
  const context = useContext(ClientAuthContext);
  if (Object.keys(context).length === 0) {
    throw new Error('useClientAuth deve ser usado dentro de um ClientAuthProvider');
  }
  return context;
}
