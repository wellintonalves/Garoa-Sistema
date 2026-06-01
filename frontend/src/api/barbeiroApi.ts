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
    if (error.response?.status === 401) {
      if (window.location.pathname.startsWith('/barbeiro')) {
        localStorage.removeItem('@garoa:barbeiro_token');
        localStorage.removeItem('@garoa:barbeiro_dados');
        window.location.href = '/barbeiro';
      }
    }
    return Promise.reject(error);
  }
);

export default barbeiroApi;
