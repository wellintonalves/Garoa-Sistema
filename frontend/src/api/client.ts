// Cliente HTTP configurado para a API
import axios from 'axios';

// Garante que a baseURL sempre tenha protocolo (https://)
function resolveApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return 'http://localhost:3001';
  // Se não começa com http:// ou https://, adiciona https://
  if (!envUrl.startsWith('http://') && !envUrl.startsWith('https://')) {
    return `https://${envUrl}`;
  }
  return envUrl;
}

const api = axios.create({
  baseURL: resolveApiUrl(),
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor — adiciona token JWT automaticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('@barbearia:token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor — redireciona para login em caso de 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('@barbearia:token');
      localStorage.removeItem('@barbearia:usuario');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
