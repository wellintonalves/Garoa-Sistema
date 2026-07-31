import { useState, useEffect } from 'react';
import api from '../api/client';

export function useNaoLidasAdmin() {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetchCount = () => {
      api.get<{total: number}>('/chat/nao-lidas')
        .then(res => setTotal(res.data.total))
        .catch(() => {});
    };

    fetchCount();
    const interval = setInterval(fetchCount, 5000);
    return () => clearInterval(interval);
  }, []);

  return { total, setTotal };
}
