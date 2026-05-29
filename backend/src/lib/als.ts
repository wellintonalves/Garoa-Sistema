import { AsyncLocalStorage } from 'async_hooks';

interface Store {
  barbeariaId: string;
}

export const tenantStorage = new AsyncLocalStorage<Store>();
