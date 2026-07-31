import { AxiosError } from 'axios';

export function handleApiError(error: AxiosError, authRedirectCallback?: () => void) {
  // Falha de rede, timeout ou resposta sem corpo
  if (!error.response) {
    error.message = 'Não foi possível conectar ao servidor. Verifique sua conexão.';
    return Promise.reject(error);
  }

  const status = error.response.status;

  if (status === 401) {
    if (authRedirectCallback) authRedirectCallback();
    const apiMsg = (error.response.data as any)?.erro || (error.response.data as any)?.error;
    error.message = apiMsg || 'Sessão expirada ou credenciais inválidas.';
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
