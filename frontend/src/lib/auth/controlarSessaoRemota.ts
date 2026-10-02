import axios, { type AxiosInstance } from 'axios';

export type Portal = 'admin' | 'cliente' | 'barbeiro' | 'tenant';
export type EstadoSessao<T> = { dados: T | null; carregando: boolean; erro: string };
type Atualizacao<T> = T | null | ((anterior: T | null) => T | null);

export function portalDoCaminho(caminho: string): Portal {
  if (/^\/admin(?:\/|$)/.test(caminho)) return 'admin';
  if (/^\/barbeiro(?:\/|$)/.test(caminho)) return 'barbeiro';
  if (/^\/b\/[^/]+(?:\/|$)/.test(caminho)) return 'tenant';
  return 'cliente';
}

export function destinoLogin(portal: Portal, caminhoAtual: string): string {
  if (portal === 'admin') return '/admin/login';
  if (portal === 'barbeiro') return '/barbeiro/login';
  if (portal === 'tenant') return (caminhoAtual.match(/^\/b\/[^/]+/)?.[0] ?? '') + '/login';
  return '/';
}

/** One controller per provider. No credentials or session identity are persisted. */
export function controlarSessaoRemota<T>(
  api: Pick<AxiosInstance, 'get' | 'post'>,
  caminho: string,
  campo: string,
  efeitos: {
    atualizar: (estado: EstadoSessao<T>) => void;
    limparLegado: () => void;
    aposLogout: () => void;
  },
) {
  let estado: EstadoSessao<T> = { dados: null, carregando: true, erro: '' };
  let ativo = false;
  let revisao = 0;
  let controller: AbortController | undefined;
  let falhouLogout = false;
  let logoutPendente: Promise<void> | undefined;

  function publicar(alteracao: Partial<EstadoSessao<T>>) {
    estado = { ...estado, ...alteracao };
    if (ativo) efeitos.atualizar(estado);
  }

  function invalidar() {
    revisao += 1;
    controller?.abort();
    controller = undefined;
    logoutPendente = undefined;
    return revisao;
  }

  async function carregar() {
    if (!ativo) return;
    const atual = invalidar();
    const pedido = new AbortController();
    controller = pedido;
    const vigente = () => ativo && revisao === atual && !pedido.signal.aborted;
    falhouLogout = false;
    publicar({ carregando: true, erro: '' });
    try {
      const { data } = await api.get<Record<string, T>>(caminho + '/session', { signal: pedido.signal });
      if (vigente()) publicar({ dados: data[campo] ?? null });
    } catch (error) {
      if (!vigente() || axios.isCancel(error)) return;
      if (axios.isAxiosError(error) && error.response?.status === 401) publicar({ dados: null });
      else publicar({ erro: 'Não foi possível verificar sua sessão. Tente novamente em instantes.' });
    } finally {
      if (vigente()) publicar({ carregando: false });
    }
  }

  function setDados(dados: Atualizacao<T>) {
    // Explicit login/profile/logout state always wins over an older bootstrap.
    // Cancellation alone is insufficient when a response is already queued.
    invalidar();
    falhouLogout = false;
    publicar({ dados: typeof dados === 'function' ? (dados as (anterior: T | null) => T | null)(estado.dados) : dados, carregando: false, erro: '' });
  }

  function logout(): Promise<void> {
    if (!ativo) return Promise.resolve();
    if (logoutPendente) return logoutPendente;
    const atual = invalidar();
    const pedido = new AbortController();
    controller = pedido;
    const vigente = () => ativo && revisao === atual && !pedido.signal.aborted;
    falhouLogout = false;
    publicar({ carregando: false, erro: '' });
    const operacao = (async () => {
      try {
        await api.post(caminho + '/logout', undefined, { signal: pedido.signal });
        if (!vigente()) return;
        publicar({ dados: null, erro: '' });
        efeitos.limparLegado();
        efeitos.aposLogout();
      } catch (error) {
        if (!vigente() || axios.isCancel(error)) return;
        // Keep the account visible: a failed request has not ended the cookie session.
        falhouLogout = true;
        publicar({ erro: 'Não foi possível sair da conta. Verifique sua conexão e tente novamente.' });
      } finally {
        if (vigente()) logoutPendente = undefined;
      }
    })();
    logoutPendente = operacao;
    return operacao;
  }

  return {
    iniciar: () => { ativo = true; efeitos.limparLegado(); return carregar(); },
    parar: () => { ativo = false; invalidar(); },
    setDados,
    logout,
    tentarNovamente: () => logoutPendente ?? (falhouLogout ? logout() : carregar()),
  };
}
