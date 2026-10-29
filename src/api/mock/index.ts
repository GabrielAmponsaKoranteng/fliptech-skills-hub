// Wraps the mock server so it behaves like a network API: every call is async, takes time,
// can fail, and passes data by copy (so the UI can't accidentally mutate "server" state).
import { ApiError, type Api } from '../contract';
import { createMockServer } from './server';
import { read, resetDb, type OutboxMessage } from './db';

/**
 * Demo only: the newest message the mock "sent" since `since` (ISO time). Nothing is really emailed
 * in the demo, so screens like "Forgot password" show the link instead. Not part of the Api contract.
 */
export const demoOutbox = (kind: OutboxMessage['kind'], since: string): OutboxMessage | undefined =>
  read('outbox').find((m) => m.kind === kind && m.at >= since);

export interface MockConfig {
  /** Milliseconds added to every call */
  latency: number;
  /** 0–1: chance a call fails with a 503, to exercise error states */
  failRate: number;
  /** Every call fails as if the network were down */
  offline: boolean;
}

const CONFIG_KEY = 'fsh.mock';

export function mockConfig(): MockConfig {
  const defaults: MockConfig = {
    latency: Number(import.meta.env.VITE_MOCK_LATENCY ?? 250),
    failRate: Number(import.meta.env.VITE_MOCK_FAIL_RATE ?? 0),
    offline: false,
  };
  try {
    return { ...defaults, ...(JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') as Partial<MockConfig>) };
  } catch {
    return defaults;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Method = (...args: unknown[]) => Promise<unknown>;

function wrap(server: Api): Api {
  const out: Record<string, Record<string, Method>> = {};
  for (const [ns, methods] of Object.entries(server) as [string, Record<string, Method>][]) {
    out[ns] = {};
    for (const [name, fn] of Object.entries(methods)) {
      out[ns][name] = async (...args: unknown[]) => {
        const cfg = mockConfig();
        // Jitter so concurrent requests don't resolve in lock-step.
        await sleep(cfg.latency * (0.6 + Math.random() * 0.8));
        if (cfg.offline) throw new ApiError(0, 'network', 'You appear to be offline. Check your connection and try again.');
        if (Math.random() < cfg.failRate) throw new ApiError(503, 'server', 'Something went wrong on our side. Please try again.');
        const result = await fn(...structuredClone(args));
        return result === undefined ? undefined : structuredClone(result);
      };
    }
  }
  return out as unknown as Api;
}

export function createMockApi(): Api {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    // Dev helpers, e.g. in the console: fshMock.set({ latency: 1500, failRate: 0.3 })
    (window as unknown as { fshMock: unknown }).fshMock = {
      config: mockConfig,
      set(patch: Partial<MockConfig>) { localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...mockConfig(), ...patch })); },
      clear() { localStorage.removeItem(CONFIG_KEY); },
      /** Restore all demo data and reload */
      reset() { resetDb(); location.reload(); },
    };
  }
  return wrap(createMockServer());
}
