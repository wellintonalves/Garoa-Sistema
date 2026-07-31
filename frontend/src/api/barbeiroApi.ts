// Cliente HTTP isolado para o app do barbeiro
import axios from 'axios';
import { handleApiError } from './errorHandler';

function resolveApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return 'http://localhost:3001';
  if (envUrl.startsWith('/')) return envUrl;
  if (!envUrl.startsWith('http://') && !envUrl.startsWith('https://')) {
    return `https://${envUrl}`;
  }
  return envUrl;
}

const barbeiroApi = axios.create({
  baseURL: resolveApiUrl(),
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor — adiciona token JWT do barbeiro automaticamente
barbeiroApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('@garoa:barbeiro_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor — redireciona para login do barbeiro em caso de 401
barbeiroApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const rotasCriticas = ['/barbeiro/perfil', '/barbeiro/agenda-hoje'];
    const ehRotaCritica = rotasCriticas.some((r) => url.includes(r));
    return handleApiError(error, () => {
      if (ehRotaCritica && window.location.pathname.startsWith('/barbeiro')) {
        localStorage.removeItem('@garoa:barbeiro_token');
        localStorage.removeItem('@garoa:barbeiro_dados');
        window.location.href = '/barbeiro/login';
      }
    });
  }
);

export default barbeiroApi;
