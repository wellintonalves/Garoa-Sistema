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
  const token = localStorage.getItem('@garoa:token');
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
      localStorage.removeItem('@garoa:token');
      localStorage.removeItem('@garoa:usuario');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

// Deduplicação de requisições GET simultâneas (evita requests repetidos na montagem)
const pendingRequests = new Map<string, Promise<any>>();
const originalGet = api.get;

api.get = function (url: string, config?: any) {
  const key = `get:${url}:${JSON.stringify(config?.params || {})}`;

  if (pendingRequests.has(key)) {
    return pendingRequests.get(key) as Promise<any>;
  }

  const promise = originalGet.apply(this, [url, config]).finally(() => {
    // Remove do cache assim que a promise resolve ou rejeita
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, promise);
  return promise;
};

export default api;
