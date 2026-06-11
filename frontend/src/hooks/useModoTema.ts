import { useState, useEffect } from 'react';

export type ModoTema = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'garoa-modo-tema';

function aplicarModo(modo: ModoTema) {
  const root = document.documentElement;
  
  if (modo === 'auto') {
    const prefereDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('light', !prefereDark);
  } else if (modo === 'light') {
    root.classList.add('light');
  } else {
    root.classList.remove('light');
  }
}

export function useModoTema() {
  const [modo, setModoState] = useState<ModoTema>(() => {
    return (localStorage.getItem(STORAGE_KEY) as ModoTema) || 'auto';
  });

  useEffect(() => {
    aplicarModo(modo);

    if (modo === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => aplicarModo('auto');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [modo]);

  function setModo(novoModo: ModoTema) {
    localStorage.setItem(STORAGE_KEY, novoModo);
    setModoState(novoModo);
  }

  return { modo, setModo };
}
