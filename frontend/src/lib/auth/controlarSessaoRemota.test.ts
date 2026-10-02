import { AxiosError, AxiosHeaders, type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { controlarSessaoRemota, destinoLogin, portalDoCaminho, type EstadoSessao } from './controlarSessaoRemota';

type Usuario = { id: string; nome: string };
type Resposta = { data: Record<string, Usuario> };

function pendente<T>() {
  let resolve!: (valor: T) => void;
  let reject!: (erro: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function erroHttp(status: number) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Falha HTTP', undefined, config, undefined, { status, statusText: '', data: {}, headers: {}, config });
}

function preparar(caminho = '/auth', campo = 'usuario') {
  const consultas: ReturnType<typeof pendente<Resposta>>[] = [];
  const saidas: ReturnType<typeof pendente<Resposta>>[] = [];
  // Deliberately ignore abort: the generation guard must also reject responses
  // already delivered by the transport before cancellation reached it.
  const get = vi.fn((_url: string, _config?: AxiosRequestConfig) => {
    const pedido = pendente<Resposta>(); consultas.push(pedido); return pedido.promise;
  });
  const post = vi.fn((_url: string, _dados?: unknown, _config?: AxiosRequestConfig) => {
    const pedido = pendente<Resposta>(); saidas.push(pedido); return pedido.promise;
  });
  const atualizar = vi.fn<(estado: EstadoSessao<Usuario>) => void>();
  const limparLegado = vi.fn();
  const aposLogout = vi.fn();
  const controle = controlarSessaoRemota<Usuario>({ get, post } as unknown as Pick<AxiosInstance, 'get' | 'post'>, caminho, campo, { atualizar, limparLegado, aposLogout });
  const estado = () => atualizar.mock.calls.at(-1)![0];
  return { controle, consultas, saidas, get, post, atualizar, limparLegado, aposLogout, estado };
}

const anterior = { id: 'anterior', nome: 'Antes' };
const atual = { id: 'atual', nome: 'Agora' };

describe('coordenação da sessão remota', () => {
  it.each([
    ['/auth', 'usuario'], ['/cliente', 'cliente'], ['/barbeiro', 'barbeiro'], ['/b/auth', 'usuario'],
  ])('carrega a identidade correta de %s e limpa somente o legado', async (caminho, campo) => {
    const t = preparar(caminho, campo);
    const bootstrap = t.controle.iniciar();
    expect(t.estado()).toEqual({ dados: null, carregando: true, erro: '' });
    expect(t.get).toHaveBeenCalledWith(caminho + '/session', { signal: expect.any(AbortSignal) });
    t.consultas[0].resolve({ data: { [campo]: atual } });
    await bootstrap;
    expect(t.estado()).toEqual({ dados: atual, carregando: false, erro: '' });
    expect(t.limparLegado).toHaveBeenCalledTimes(1);
    expect(t.aposLogout).not.toHaveBeenCalled();
  });

  it.each([200, 401, 503])('bootstrap tardio %s não sobrescreve login explícito', async status => {
    const t = preparar();
    const bootstrap = t.controle.iniciar();
    const signal = t.get.mock.calls[0][1]?.signal;
    t.controle.setDados(atual);
    expect(signal?.aborted).toBe(true);
    if (status === 200) t.consultas[0].resolve({ data: { usuario: anterior } });
    else t.consultas[0].reject(erroHttp(status));
    await bootstrap;
    expect(t.estado()).toEqual({ dados: atual, carregando: false, erro: '' });
    expect(t.aposLogout).not.toHaveBeenCalled();
  });

  it('bootstrap 401 encerra carregamento como anônimo sem erro ou navegação', async () => {
    const t = preparar();
    const bootstrap = t.controle.iniciar();
    t.consultas[0].reject(erroHttp(401));
    await bootstrap;
    expect(t.estado()).toEqual({ dados: null, carregando: false, erro: '' });
    expect(t.aposLogout).not.toHaveBeenCalled();
  });

  it.each([404, 429, 500])('falha %s fica visível e pode ser repetida sem virar sessão anônima', async status => {
    const t = preparar();
    const bootstrap = t.controle.iniciar();
    t.consultas[0].reject(erroHttp(status));
    await bootstrap;
    expect(t.estado().erro).toContain('Não foi possível verificar');
    expect(t.estado().carregando).toBe(false);
    const retry = t.controle.tentarNovamente();
    expect(t.estado().erro).toBe('');
    expect(t.estado().carregando).toBe(true);
    t.consultas[1].resolve({ data: { usuario: atual } });
    await retry;
    expect(t.estado()).toEqual({ dados: atual, carregando: false, erro: '' });
    expect(t.post).not.toHaveBeenCalled();
  });

  it('erro de rede não é convertido em credenciais inválidas', async () => {
    const t = preparar();
    const bootstrap = t.controle.iniciar();
    t.consultas[0].reject(new AxiosError('Network Error'));
    await bootstrap;
    expect(t.estado().erro).toContain('Não foi possível verificar');
    expect(t.aposLogout).not.toHaveBeenCalled();
  });

  it('resposta de tentativa antiga não altera uma tentativa mais nova', async () => {
    const t = preparar();
    const first = t.controle.iniciar();
    const retry = t.controle.tentarNovamente();
    t.consultas[1].resolve({ data: { usuario: atual } });
    await retry;
    t.consultas[0].reject(erroHttp(401));
    await first;
    expect(t.estado()).toEqual({ dados: atual, carregando: false, erro: '' });
  });

  it('StrictMode cancela o primeiro efeito sem contaminar o efeito remontado', async () => {
    const t = preparar();
    const first = t.controle.iniciar();
    t.controle.parar();
    expect(t.get.mock.calls[0][1]?.signal?.aborted).toBe(true);
    const second = t.controle.iniciar();
    t.consultas[0].reject(erroHttp(500));
    await first;
    expect(t.estado()).toEqual({ dados: null, carregando: true, erro: '' });
    t.consultas[1].resolve({ data: { usuario: atual } });
    await second;
    expect(t.estado()).toEqual({ dados: atual, carregando: false, erro: '' });
  });

  it('desmontagem impede atualizações tardias e redirecionamento', async () => {
    const t = preparar();
    const bootstrap = t.controle.iniciar();
    const saida = t.controle.logout();
    t.controle.parar();
    t.atualizar.mockClear();
    t.consultas[0].resolve({ data: { usuario: anterior } });
    t.saidas[0].resolve({ data: {} });
    await Promise.all([bootstrap, saida]);
    expect(t.atualizar).not.toHaveBeenCalled();
    expect(t.aposLogout).not.toHaveBeenCalled();
  });

  it.each([200, 401, 500])('bootstrap tardio %s não restaura estado após logout', async status => {
    const t = preparar();
    const bootstrap = t.controle.iniciar();
    t.controle.setDados(atual);
    const saida = t.controle.logout();
    t.saidas[0].resolve({ data: {} });
    await saida;
    if (status === 200) t.consultas[0].resolve({ data: { usuario: anterior } });
    else t.consultas[0].reject(erroHttp(status));
    await bootstrap;
    expect(t.estado()).toEqual({ dados: null, carregando: false, erro: '' });
    expect(t.aposLogout).toHaveBeenCalledTimes(1);
    expect(t.limparLegado).toHaveBeenCalledTimes(2);
  });

  it('duplo clique em sair envia somente um logout', async () => {
    const t = preparar();
    void t.controle.iniciar();
    t.controle.setDados(atual);
    const first = t.controle.logout();
    const second = t.controle.logout();
    expect(first).toBe(second);
    expect(t.post).toHaveBeenCalledTimes(1);
    t.saidas[0].resolve({ data: {} });
    await first;
    expect(t.aposLogout).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403, 500])('logout %s preserva identidade e repete POST ao tentar novamente', async status => {
    const t = preparar();
    void t.controle.iniciar();
    t.controle.setDados(atual);
    const saida = t.controle.logout();
    t.saidas[0].reject(erroHttp(status));
    await saida;
    expect(t.estado().dados).toEqual(atual);
    expect(t.estado().erro).toContain('Não foi possível sair');
    expect(t.aposLogout).not.toHaveBeenCalled();
    expect(t.limparLegado).toHaveBeenCalledTimes(1);
    const retry = t.controle.tentarNovamente();
    expect(t.post).toHaveBeenCalledTimes(2);
    expect(t.get).toHaveBeenCalledTimes(1);
    t.saidas[1].resolve({ data: {} });
    await retry;
    expect(t.estado()).toEqual({ dados: null, carregando: false, erro: '' });
    expect(t.aposLogout).toHaveBeenCalledTimes(1);
  });

  it('login explícito após falha de logout remove a falha e a ação de repetição antiga', async () => {
    const t = preparar();
    void t.controle.iniciar();
    t.controle.setDados(anterior);
    const saida = t.controle.logout();
    t.saidas[0].reject(new AxiosError('Network Error'));
    await saida;
    t.controle.setDados(atual);
    expect(t.estado()).toEqual({ dados: atual, carregando: false, erro: '' });
    const retry = t.controle.tentarNovamente();
    expect(t.get).toHaveBeenCalledTimes(2);
    expect(t.post).toHaveBeenCalledTimes(1);
    t.consultas[1].resolve({ data: { usuario: atual } });
    await retry;
  });

  it('duplo clique em tentar novamente não cancela logout ou reinicia bootstrap', async () => {
    const t = preparar();
    void t.controle.iniciar();
    t.controle.setDados(atual);
    const saida = t.controle.logout();
    t.saidas[0].reject(new AxiosError('Network Error'));
    await saida;
    const first = t.controle.tentarNovamente();
    const second = t.controle.tentarNovamente();
    expect(first).toBe(second);
    expect(t.post).toHaveBeenCalledTimes(2);
    expect(t.get).toHaveBeenCalledTimes(1);
    expect(t.post.mock.calls[1][2]?.signal?.aborted).toBe(false);
    t.saidas[1].resolve({ data: {} });
    await first;
    expect(t.aposLogout).toHaveBeenCalledTimes(1);
  });

  it('logout antigo não apaga estado explícito mais novo ou redireciona', async () => {
    const t = preparar();
    void t.controle.iniciar();
    t.controle.setDados(anterior);
    const saida = t.controle.logout();
    t.controle.setDados(atual);
    t.saidas[0].resolve({ data: {} });
    await saida;
    expect(t.estado()).toEqual({ dados: atual, carregando: false, erro: '' });
    expect(t.aposLogout).not.toHaveBeenCalled();
  });

  it('atualização funcional usa a identidade mais recente e invalida bootstrap', async () => {
    const t = preparar();
    const bootstrap = t.controle.iniciar();
    t.controle.setDados(atual);
    t.controle.setDados(dados => dados ? { ...dados, nome: 'Nome alterado' } : null);
    t.consultas[0].resolve({ data: { usuario: anterior } });
    await bootstrap;
    expect(t.estado().dados).toEqual({ ...atual, nome: 'Nome alterado' });
  });
});

describe('destino de login por portal', () => {
  it.each([
    ['admin', '/admin/agenda', '/admin/login'],
    ['barbeiro', '/barbeiro/perfil', '/barbeiro/login'],
    ['cliente', '/cliente/agendamentos', '/'],
    ['tenant', '/b/valen/meus-agendamentos', '/b/valen/login'],
  ] as const)('%s mantém o destino e o slug corretos', (portal, caminho, esperado) => {
    expect(portalDoCaminho(caminho)).toBe(portal);
    expect(destinoLogin(portal, caminho)).toBe(esperado);
  });
  it('nomes de rota semelhantes não ativam outro portal', () => {
    expect(portalDoCaminho('/administracao')).toBe('cliente');
    expect(portalDoCaminho('/barbeiros')).toBe('cliente');
  });
});
