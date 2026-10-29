import { useSearchParams } from 'react-router-dom';

/** The order whose details are open, kept in `?order=` so notifications and shared links can open it directly. */
export function useOrderParam(): [string | null, (id: string | null) => void] {
  const [params, setParams] = useSearchParams();
  const set = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('order', id); else next.delete('order');
    setParams(next, { replace: true });
  };
  return [params.get('order'), set];
}
