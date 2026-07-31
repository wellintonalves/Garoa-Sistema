import { useState, useEffect } from 'react';
import clienteApi from '../api/clienteApi';

export function useNaoLidasCliente(barbeariaId?: string) {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!barbeariaId) return;

    const fetchCount = () => {
      clienteApi.get<{total: number}>(`/cliente/barbearia/${barbeariaId}/chat/nao-lidas`)
        .then(res => setTotal(res.data.total))
        .catch(() => {});
    };

    fetchCount();
    const interval = setInterval(fetchCount, 5000);
    return () => clearInterval(interval);
  }, [barbeariaId]);

  return { total, setTotal };
}
