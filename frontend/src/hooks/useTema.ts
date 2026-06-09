import { useCallback } from 'react';
import api from '../api/client';
import clienteApi from '../api/clienteApi';
import { gerarCorIcone } from '../utils/cores';

export interface TemaBarbearia {
  corPrimaria?: string;
  corSecundaria?: string;
  corTexto?: string;
  corFundo?: string;
  fonte?: string;
  fonteCorpo?: string;
  fonteNumeros?: string;
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
    if (tema.corSecundaria) {
      root.style.setProperty('--cor-secundaria', tema.corSecundaria);
    }
    if (tema.corTexto) {
      root.style.setProperty('--cor-texto', tema.corTexto);
    }
    if (tema.corFundo) {
      root.style.setProperty('--cor-fundo', tema.corFundo);
    }
    
    const carregarFonte = (nomeFonte: string, cssVar: string) => {
      root.style.setProperty(cssVar, `'${nomeFonte}', sans-serif`);
      if (nomeFonte !== 'Inter') {
        const fontId = `font-${nomeFonte.replace(/\s+/g, '-')}`;
        if (!document.getElementById(fontId)) {
          const link = document.createElement('link');
          link.id = fontId;
          link.href = `https://fonts.googleapis.com/css2?family=${nomeFonte.replace(/ /g, '+')}:wght@400;500;600;700;800&display=swap`;
          link.rel = 'stylesheet';
          document.head.appendChild(link);
        }
      }
    };

    if (tema.fonte) {
      carregarFonte(tema.fonte, '--fonte-titulo');
    }
    if (tema.fonteCorpo) {
      carregarFonte(tema.fonteCorpo, '--fonte-corpo');
    }
    if (tema.fonteNumeros) {
      // Para números, as fontes podem ser diferentes, mas a URL do google fonts é similar
      carregarFonte(tema.fonteNumeros, '--fonte-numeros');
    }

    // Salvar no localStorage como cache
    localStorage.setItem('temaBarbearia', JSON.stringify(tema));
  }, []);

  const limparTema = useCallback(() => {
    const root = document.documentElement;
    root.style.removeProperty('--cor-primaria');
    root.style.removeProperty('--cor-secundaria');
    root.style.removeProperty('--cor-texto');
    root.style.removeProperty('--cor-fundo');
    root.style.removeProperty('--fonte-titulo');
    root.style.removeProperty('--fonte-corpo');
    root.style.removeProperty('--fonte-numeros');
    root.style.removeProperty('--amber');
    root.style.removeProperty('--font-display');
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
