import { useCallback } from 'react';
import api from '../api/client';
import clienteApi from '../api/clienteApi';

export interface TemaBarbearia {
  corPrimaria?: string;
  corSecundaria?: string;
  corTexto?: string;
  corFundo?: string;
  fonte?: string;
}

export function useTema() {
  const aplicarTema = useCallback((tema: TemaBarbearia) => {
    const root = document.documentElement;

    if (tema.corPrimaria) {
      root.style.setProperty('--cor-primaria', tema.corPrimaria);
    }
    if (tema.corSecundaria) {
      root.style.setProperty('--cor-secundaria', tema.corSecundaria);
    }
    if (tema.corTexto) {
      root.style.setProperty('--cor-texto', tema.corTexto);
    }
    if (tema.corFundo) {
      root.style.setProperty('--cor-fundo', tema.corFundo);
    }
    
    if (tema.fonte) {
      root.style.setProperty('--fonte-titulo', `'${tema.fonte}', sans-serif`);
      if (tema.fonte !== 'Inter') {
        const fontId = `font-${tema.fonte.replace(/\s+/g, '-')}`;
        if (!document.getElementById(fontId)) {
          const link = document.createElement('link');
          link.id = fontId;
          link.href = `https://fonts.googleapis.com/css2?family=${tema.fonte.replace(/ /g, '+')}:wght@400;600;700;800&display=swap`;
          link.rel = 'stylesheet';
          document.head.appendChild(link);
        }
      }
    }

    // Salvar no localStorage como cache
    localStorage.setItem('temaBarbearia', JSON.stringify(tema));
  }, []);

  const carregarTemaCache = useCallback(() => {
    const cache = localStorage.getItem('temaBarbearia');
    if (cache) {
      try {
        aplicarTema(JSON.parse(cache));
      } catch (e) {
        console.error('Erro ao ler tema do cache', e);
      }
    }
  }, [aplicarTema]);

  const carregarTemaAdmin = useCallback(async () => {
    try {
      const res = await api.get('/configuracoes/minha-barbearia');
      if (res.data) {
        aplicarTema(res.data);
      }
    } catch (error) {
      console.error('Erro ao buscar tema do admin', error);
    }
  }, [aplicarTema]);

  const carregarTemaCliente = useCallback(async (slug: string) => {
    try {
      const res = await clienteApi.get(`/b/${slug}/identidade`);
      if (res.data) {
        aplicarTema(res.data);
      }
    } catch (error) {
      console.error('Erro ao buscar tema do cliente', error);
    }
  }, [aplicarTema]);

  return {
    aplicarTema,
    carregarTemaCache,
    carregarTemaAdmin,
    carregarTemaCliente
  };
}
