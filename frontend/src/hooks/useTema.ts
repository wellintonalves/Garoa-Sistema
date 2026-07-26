import { useCallback } from 'react';
import api from '../api/client';
import clienteApi from '../api/clienteApi';
import { aplicarTema as aplicarTemaFn, TemaBarbearia } from '../theme/aplicarTema';

export type { TemaBarbearia };

export function obterModoAtual(): 'claro' | 'escuro' {
  if (typeof window === 'undefined') return 'escuro';
  const modoSalvo = localStorage.getItem('garoa-modo-tema') || 'auto';
  const ehEscuro =
    modoSalvo === 'dark' ||
    (modoSalvo === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return ehEscuro ? 'escuro' : 'claro';
}

export function useTema() {
  const aplicarTema = useCallback((tema: TemaBarbearia, modo?: 'claro' | 'escuro') => {
    const modoAlvo = modo || obterModoAtual();
    aplicarTemaFn(tema, modoAlvo);

    // Salvar no localStorage como cache
    if (tema) {
      localStorage.setItem('temaBarbearia', JSON.stringify(tema));
    }
  }, []);

  /**
   * Remove os overrides inline de tema — os valores padrão do :root CSS tomam conta.
   * Também limpa o cache do localStorage para não re-aplicar no próximo carregamento.
   */
  const limparTema = useCallback(() => {
    const root = document.documentElement;
    const tokens = [
      '--cor-primaria', '--amber', '--cor-primaria-rgb', '--cor-icone',
      '--fundo-pagina', '--fundo-superficie', '--superficie-1', '--fundo-superficie-2',
      '--superficie-2', '--fundo-superficie-3', '--superficie-3', '--borda', '--borda-sutil',
      '--borda-media', '--borda-forte', '--texto-principal', '--texto-secundario', '--texto-terciario',
      '--cor-primaria-hover', '--cor-primaria-ativa', '--cor-primaria-texto', '--texto-sobre-primaria'
    ];
    tokens.forEach(t => root.style.removeProperty(t));
    localStorage.removeItem('temaBarbearia');
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
