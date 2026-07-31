// Cliente HTTP isolado para o app do cliente
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
    return handleApiError(error, () => {
      if (window.location.pathname.startsWith('/cliente')) {
        localStorage.removeItem('@garoa:cliente_token');
        localStorage.removeItem('@garoa:cliente_dados');
        window.location.href = '/cliente';
      }
    });
  }
);

export const getDisponibilidadeSemana = async (
  barbeariaId: string,
  query: { barbeiroId?: string; duracao?: number; inicio?: string; fim?: string }
) => {
  const params = new URLSearchParams();
  if (query.barbeiroId) params.append('barbeiroId', query.barbeiroId);
  if (query.duracao) params.append('duracao', String(query.duracao));
  if (query.inicio) params.append('inicio', query.inicio);
  if (query.fim) params.append('fim', query.fim);
  return clienteApi.get(`/cliente/barbearia/${barbeariaId}/disponibilidade-semana?${params.toString()}`);
};

export default clienteApi;
