import type {
  ApiEnvelope,
  PublicCultivarDetail,
  PublicCultivarSummary,
  PublicSpecies,
} from './types';

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
// Dev with Vite proxy: VITE_API_BASE_URL is empty, requests go to /api/public/...
// Prod: VITE_API_BASE_URL = https://api.factree.com.au/api
export const API_BASE = RAW_BASE.replace(/\/$/, '') || '/api';

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as ApiEnvelope<T>;
  if (!body.success || body.data === undefined) {
    throw new Error(body.error?.message || 'Request failed');
  }
  return body.data;
}

export function listSpecies() {
  return getJson<PublicSpecies[]>('/public/species');
}

export function listCultivars(speciesSlug?: string) {
  const qs = speciesSlug ? `?species=${encodeURIComponent(speciesSlug)}` : '';
  return getJson<PublicCultivarSummary[]>(`/public/cultivars${qs}`);
}

export function getCultivar(id: number) {
  return getJson<PublicCultivarDetail>(`/public/cultivars/${id}`);
}

export function mediaUrl(mediaId: number | null | undefined): string | null {
  if (!mediaId) return null;
  return `${API_BASE}/public/media/${mediaId}/file`;
}
