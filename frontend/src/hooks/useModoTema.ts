import { useState, useEffect } from 'react';
import { aplicarTema } from '../theme/aplicarTema';

export type ModoTema = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'garoa-modo-tema';

function aplicarModo(modo: ModoTema) {
  const root = document.documentElement;
  let ehEscuro = false;

  if (modo === 'auto') {
    ehEscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
  } else {
    ehEscuro = modo === 'dark';
  }

  root.classList.toggle('light', !ehEscuro);
  const modoAlvo = ehEscuro ? 'escuro' : 'claro';
  root.setAttribute('data-tema', modoAlvo);

  const cache = localStorage.getItem('temaBarbearia');
  if (cache) {
    try {
      const tema = JSON.parse(cache);
      aplicarTema(tema, modoAlvo);
    } catch (e) {
      console.error('Erro ao re-aplicar tema no modo', e);
    }
  } else {
    aplicarTema({}, modoAlvo);
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
