import { useEffect, useState } from 'react';
import { listSpecies } from '../lib/api';
import type { PublicSpecies } from '../lib/types';

interface State {
  species: PublicSpecies[];
  loading: boolean;
  error: string | null;
}

let cache: PublicSpecies[] | null = null;
let inflight: Promise<PublicSpecies[]> | null = null;

/**
 * Shared species fetcher. The species list drives the top nav on every page,
 * so we cache it process-wide to avoid one request per route transition.
 */
export function useSpecies(): State {
  const [state, setState] = useState<State>(() => ({
    species: cache ?? [],
    loading: cache === null,
    error: null,
  }));

  useEffect(() => {
    let cancelled = false;
    if (cache) return;
    if (!inflight) inflight = listSpecies();
    inflight
      .then((data) => {
        cache = data;
        if (!cancelled) setState({ species: data, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ species: [], loading: false, error: err instanceof Error ? err.message : 'Failed to load' });
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
