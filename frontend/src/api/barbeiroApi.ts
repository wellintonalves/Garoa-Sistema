// Cliente HTTP isolado para o app do barbeiro
import axios from 'axios';
import { handleApiError } from './errorHandler';

const barbeiroApi = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json', 'X-Valen-Client': 'web', 'X-Valen-Portal': 'barbeiro' },
});

// Interceptor — redireciona para login do barbeiro em caso de 401
barbeiroApi.interceptors.response.use(
  (response) => response,
  (error) => handleApiError(error)
);

export default barbeiroApi;
