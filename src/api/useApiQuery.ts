import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

export interface Query<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  /** Fetch again (keeps showing the old data while loading) */
  reload: () => Promise<void>;
  /** Update the cached data after a successful mutation */
  setData: Dispatch<SetStateAction<T | undefined>>;
}

/**
 * Loads page-level data from the API, e.g. `useApiQuery(() => api.admin.users(), [])`.
 * Responses that arrive after the inputs changed (or the page closed) are ignored.
 */
export function useApiQuery<T>(fn: () => Promise<T>, deps: unknown[]): Query<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current();
      if (n === seq.current) setData(result);
    } catch (e) {
      if (n === seq.current) setError(e);
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); return () => { seq.current++; }; }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, error, loading, reload, setData };
}
