import { AxiosError } from 'axios';
import { limparSessao } from '../lib/auth/limparSessao';

export function handleApiError(error: AxiosError, authRedirectCallback?: () => void) {
  // Falha de rede, timeout ou resposta sem corpo
  if (!error.response) {
    error.message = 'Não foi possível conectar ao servidor. Verifique sua conexão.';
    return Promise.reject(error);
  }

  const status = error.response.status;

  if (status === 401) {
    const url = error.config?.url || '';
    if (!url.includes('/login') && !url.includes('/auth')) {
      limparSessao();

      const path = window.location.pathname;
      if (path.startsWith('/barbeiro')) {
        window.location.href = '/barbeiro/login?exp=1';
      } else if (path.startsWith('/admin')) {
        window.location.href = '/admin/login?exp=1';
      } else {
        window.location.href = '/?exp=1';
      }
    }

    if (authRedirectCallback) authRedirectCallback();
    const apiMsg = (error.response.data as any)?.erro || (error.response.data as any)?.error;
    error.message = apiMsg || 'Sua sessão expirou. Entre novamente para continuar.';
  } else if (status === 403) {
    error.message = 'Você não tem permissão para realizar esta ação.';
  } else if (status === 404) {
    error.message = 'Recurso não encontrado.';
  } else if (status >= 500) {
    error.message = 'Erro no servidor. Tente novamente em instantes.';
  } else {
    // Retém mensagem da API para outros erros, se houver
    const apiMsg = (error.response.data as any)?.erro || (error.response.data as any)?.error;
    if (apiMsg) {
      error.message = apiMsg;
    }
  }

  return Promise.reject(error);
}
