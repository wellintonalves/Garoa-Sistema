// Cliente HTTP isolado para o app do cliente
import axios from 'axios';
import { handleApiError } from './errorHandler';

const clienteApi = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json', 'X-Valen-Client': 'web', 'X-Valen-Portal': 'cliente' },
});

// Interceptor — redireciona para login do cliente em caso de 401
clienteApi.interceptors.response.use(
  (response) => response,
  (error) => handleApiError(error)
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
