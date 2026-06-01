// Cliente HTTP isolado para o app do cliente
import axios from 'axios';

function resolveApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return 'http://localhost:3001';
  if (!envUrl.startsWith('http://') && !envUrl.startsWith('https://')) {
    return `https://${envUrl}`;
  }
  return envUrl;
}

const clienteApi = axios.create({
  baseURL: resolveApiUrl(),
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor — adiciona token JWT do cliente automaticamente
clienteApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('@garoa:cliente_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor — redireciona para login do cliente em caso de 401
clienteApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Só redireciona se estiver na área do cliente
      if (window.location.pathname.startsWith('/cliente')) {
        localStorage.removeItem('@garoa:cliente_token');
        localStorage.removeItem('@garoa:cliente_dados');
        window.location.href = '/cliente';
      }
    }
    return Promise.reject(error);
  }
);

export default clienteApi;
