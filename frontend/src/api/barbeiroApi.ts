// Cliente HTTP isolado para o app do barbeiro
import axios from 'axios';

function resolveApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return 'http://localhost:3001';
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
    const status = error.response?.status;
    const url = error.config?.url || '';
    // Só desloga se o endpoint de sessão do proprio barbeiro rejeitar o token,
    // evitando que um 401 de rota secundaria derrube a sessao inteira.
    const rotasCriticas = ['/barbeiro/perfil', '/barbeiro/agenda-hoje'];
    const ehRotaCritica = rotasCriticas.some((r) => url.includes(r));
    if (status === 401 && ehRotaCritica && window.location.pathname.startsWith('/barbeiro')) {
      localStorage.removeItem('@garoa:barbeiro_token');
      localStorage.removeItem('@garoa:barbeiro_dados');
      window.location.href = '/barbeiro/login';
    }
    return Promise.reject(error);
  }
);

export default barbeiroApi;
