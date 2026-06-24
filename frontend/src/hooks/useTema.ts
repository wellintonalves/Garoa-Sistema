import { useCallback } from 'react';
import api from '../api/client';
import clienteApi from '../api/clienteApi';
import { gerarCorIcone } from '../utils/cores';

export interface TemaBarbearia {
  corPrimaria?: string;
}

export function useTema() {
  const aplicarTema = useCallback((tema: TemaBarbearia) => {
    const root = document.documentElement;

    if (tema.corPrimaria) {
      root.style.setProperty('--cor-primaria', tema.corPrimaria);
      
      const r = parseInt(tema.corPrimaria.slice(1,3), 16);
      const g = parseInt(tema.corPrimaria.slice(3,5), 16);
      const b = parseInt(tema.corPrimaria.slice(5,7), 16);
      root.style.setProperty('--cor-primaria-rgb', `${r},${g},${b}`);
      root.style.setProperty('--cor-icone', gerarCorIcone(tema.corPrimaria));
    }


    // Salvar no localStorage como cache
    localStorage.setItem('temaBarbearia', JSON.stringify(tema));
  }, []);

  const limparTema = useCallback(() => {
    const root = document.documentElement;
    root.style.removeProperty('--cor-primaria');
    root.style.removeProperty('--cor-primaria-rgb');
    root.style.removeProperty('--cor-icone');
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
    carregarTemaCliente,
    limparTema
  };
}
