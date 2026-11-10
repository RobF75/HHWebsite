import { useEffect, useState } from 'react';
import { listMerchandise } from '../lib/api';
import type { PublicMerchandise } from '../lib/types';

interface State {
  items: PublicMerchandise[];
  loading: boolean;
  error: string | null;
}

let cache: PublicMerchandise[] | null = null;
let inflight: Promise<PublicMerchandise[]> | null = null;

/**
 * The site's merchandise (fertiliser, pots), cached for the tab like the
 * species list: the nav shows a Supplies link only when there is some.
 */
export function useMerchandise(): State {
  const [state, setState] = useState<State>(() => ({
    items: cache ?? [],
    loading: cache === null,
    error: null,
  }));

  useEffect(() => {
    let cancelled = false;
    if (cache) return;
    if (!inflight) inflight = listMerchandise();
    inflight
      .then((data) => {
        cache = data;
        if (!cancelled) setState({ items: data, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ items: [], loading: false, error: err instanceof Error ? err.message : 'Failed to load' });
        }
      })
      .finally(() => {
        inflight = null;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
