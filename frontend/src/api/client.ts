// Cliente HTTP configurado para a API
import axios from 'axios';
import { handleApiError } from './errorHandler';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json', 'X-Valen-Client': 'web', 'X-Valen-Portal': 'admin' },
});

api.interceptors.request.use(config => {
  if (config.url?.startsWith('/b/')) config.headers.set('X-Valen-Portal', 'tenant');
  return config;
});

// Interceptor — redireciona para login em caso de 401
api.interceptors.response.use(
  (response) => response,
  (error) => handleApiError(error)
);

// Deduplicação de requisições GET simultâneas (evita requests repetidos na montagem)
const pendingRequests = new Map<string, Promise<any>>();
const originalGet = api.get;

api.get = function (url: string, config?: any) {
  // Cada consumidor com AbortSignal possui seu próprio ciclo de vida.
  // Compartilhar a promise faria um efeito remontado herdar o abort anterior.
  if (config?.signal) return originalGet.apply(this, [url, config]);

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
