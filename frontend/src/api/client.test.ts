import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanceledError, type AxiosAdapter, type AxiosResponse } from 'axios';
import api from './client';

describe('GET e ciclos de cancelamento', () => {
  const originalAdapter = api.defaults.adapter;
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: () => null });
  });
  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    vi.unstubAllGlobals();
  });

  it('remontagem após abort não herda a requisição cancelada do primeiro efeito', async () => {
    const pending: Array<() => void> = [];
    const adapter = vi.fn<AxiosAdapter>((config) => new Promise((resolve, reject) => {
      config.signal?.addEventListener?.('abort', () => reject(new CanceledError()));
      pending.push(() => resolve({ data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config }));
    }));
    api.defaults.adapter = adapter;
    const firstController = new AbortController();
    const first = api.get('/assinatura', { signal: firstController.signal }).catch(error => error);
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
    firstController.abort();
    // StrictMode reexecuta o efeito antes da promise abortada limpar a deduplicação.
    const second = api.get('/assinatura', { signal: new AbortController().signal });
    const secondResult = second.catch(error => error);
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(2));
    pending[1]();
    expect((await first).code).toBe('ERR_CANCELED');
    expect((await secondResult as AxiosResponse).data).toEqual({ ok: true });
  });

  it('continua deduplicando GET simultâneos sem signal', async () => {
    let finish!: () => void;
    const adapter = vi.fn<AxiosAdapter>((config) => new Promise(resolve => {
      finish = () => resolve({ data: [], status: 200, statusText: 'OK', headers: {}, config });
    }));
    api.defaults.adapter = adapter;
    const first = api.get('/clientes');
    const second = api.get('/clientes');
    expect(second).toBe(first);
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
    finish();
    await Promise.all([first, second]);
    const third = api.get('/clientes');
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(2));
    finish();
    await third;
  });
});
