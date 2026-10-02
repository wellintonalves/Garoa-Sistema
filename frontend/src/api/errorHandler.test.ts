import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleApiError } from './errorHandler';

afterEach(() => vi.unstubAllGlobals());

function preparar(pathname: string, url: string) {
  const location = { pathname, href: pathname };
  vi.stubGlobal('window', { location });
  vi.stubGlobal('localStorage', { removeItem: vi.fn() });
  const config = { url, headers: new AxiosHeaders() };
  const erro = new AxiosError('Unauthorized', undefined, config, undefined, { status: 401, statusText: '', data: {}, headers: {}, config });
  return { location, erro };
}

describe('sessões paralelas não redirecionam para outro portal', () => {
  it.each(['/admin/agenda', '/cliente/conta', '/barbeiro/agenda', '/b/valen/perfil'])('401 de bootstrap em %s não navega, em nenhum provedor', async pathname => {
    for (const endpoint of ['/auth/session', '/cliente/session', '/barbeiro/session', '/b/auth/session']) {
      const t = preparar(pathname, endpoint);
      await expect(handleApiError(t.erro)).rejects.toBe(t.erro);
      expect(t.location.href).toBe(pathname);
    }
  });

  it.each([
    ['/admin/agenda', '/admin/login?exp=1'],
    ['/cliente/conta', '/?exp=1'],
    ['/barbeiro/agenda', '/barbeiro/login?exp=1'],
    ['/b/valen/perfil', '/b/valen/login?exp=1'],
  ])('expiração de recurso em %s retorna ao login correto', async (pathname, destino) => {
    const t = preparar(pathname, '/agendamentos');
    await expect(handleApiError(t.erro)).rejects.toBe(t.erro);
    expect(t.location.href).toBe(destino);
  });

  it.each(['/auth/logout', '/cliente/logout', '/barbeiro/logout', '/b/auth/logout'])('logout falho %s não navega nem simula sucesso', async endpoint => {
    const t = preparar('/barbeiro/agenda', endpoint);
    await expect(handleApiError(t.erro)).rejects.toBe(t.erro);
    expect(t.location.href).toBe('/barbeiro/agenda');
    expect(localStorage.removeItem).not.toHaveBeenCalled();
  });
});
