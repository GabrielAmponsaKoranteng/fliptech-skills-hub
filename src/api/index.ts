// The one API instance the app uses. Set VITE_API_URL to talk to a real backend;
// otherwise the in-browser mock server is used.
import type { Api } from './contract';
import { createHttpApi } from './http';

export const API_MODE: 'http' | 'mock' = import.meta.env.VITE_API_URL ? 'http' : 'mock';

type Method = (...args: unknown[]) => Promise<unknown>;

/**
 * An Api whose implementation is downloaded on the first call. Used for the mock server, so its
 * rules and sample data stay out of the main bundle and are never fetched when a real backend is set.
 */
function lazyApi(load: () => Promise<Api>): Api {
  let ready: Promise<Api> | null = null;
  return new Proxy({} as Api, {
    get: (_, ns) => (typeof ns !== 'string' ? undefined : new Proxy({}, {
      get: (__, method) => (typeof method !== 'string' ? undefined : async (...args: unknown[]) => {
        // If the download fails (e.g. offline), forget it so the next call tries again.
        ready ??= load().catch((e: unknown) => { ready = null; throw e; });
        const real = (await ready) as unknown as Record<string, Record<string, Method>>;
        return real[ns][method](...args);
      }),
    })),
  });
}

export const api: Api = API_MODE === 'http'
  ? createHttpApi(import.meta.env.VITE_API_URL as string)
  : lazyApi(() => import('./mock').then((m) => m.createMockApi()));

export { ApiError } from './contract';
export type { Api } from './contract';
