import type {
  ApiEnvelope,
  PublicCultivarDetail,
  PublicCultivarSummary,
  PublicMaturityChart,
  PublicMaturityFilters,
  PublicSite,
  PublicSpecies,
} from './types';
import { maturityChartQuery } from './maturityChart';
import { SITE_TARGET, isLocalPreview } from './site';

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
// Dev with Vite proxy: VITE_API_BASE_URL is empty, requests go to /api/public/...
// Prod: VITE_API_BASE_URL = https://api.factree.com.au/api
export const API_BASE = RAW_BASE.replace(/\/$/, '') || '/api';

/** A failed public read, with the server's code (SITE_MOVED, SITE_NOT_FOUND, …). */
export class ApiError extends Error {
  status: number;
  code?: string;
  movedTo?: string;
  constructor(message: string, status: number, code?: string, movedTo?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.movedTo = movedTo;
  }
}

// The organisation's slug, from the address (or its site record, which has
// the same). Images send no Origin, so they name the site.
let knownSlug: string | null = SITE_TARGET.kind === 'tenant' ? SITE_TARGET.slug : null;
export function setKnownSlug(slug: string) {
  knownSlug = slug;
}

/**
 * The storefront (sign-in, catalogue, orders) is the API's own routes, not
 * /public/v2: the server finds an organisation's shop from the Origin. A local
 * preview's Origin is localhost, so it names the site instead.
 */
export function shopSiteHeaders(): Record<string, string> {
  if (SITE_TARGET.kind !== 'tenant' || !isLocalPreview() || !knownSlug) return {};
  return { 'X-Shop-Site': knownSlug };
}

/**
 * Our site reads /public/... (v1), as it always has. An organisation's reads
 * /public/v2/..., found by the browser's Origin; locally, and for anything
 * that sends no Origin, by ?site=.
 */
function publicPath(path: string, { noOrigin = false } = {}): string {
  if (SITE_TARGET.kind === 'platform') return `/public${path}`;
  const named = knownSlug && (noOrigin || isLocalPreview());
  if (!named) return `/public/v2${path}`;
  return `/public/v2${path}${path.includes('?') ? '&' : '?'}site=${encodeURIComponent(knownSlug!)}`;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: 'application/json' },
  });
  const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok || !body || !body.success || body.data === undefined) {
    const err = body?.error as { message?: string; code?: string; moved_to?: string } | undefined;
    throw new ApiError(err?.message || `Request failed: ${res.status} ${res.statusText}`, res.status, err?.code, err?.moved_to);
  }
  return body.data;
}

/** An organisation's site: its name, branding and what it offers. */
export function getSite() {
  return getJson<PublicSite>(publicPath('/site'));
}

export function siteLogoUrl(): string {
  return `${API_BASE}${publicPath('/site/logo', { noOrigin: true })}`;
}

export function listSpecies() {
  return getJson<PublicSpecies[]>(publicPath('/species'));
}

export function listCultivars(speciesSlug?: string) {
  const qs = speciesSlug ? `?species=${encodeURIComponent(speciesSlug)}` : '';
  return getJson<PublicCultivarSummary[]>(publicPath(`/cultivars${qs}`));
}

export function getCultivar(id: number) {
  return getJson<PublicCultivarDetail>(publicPath(`/cultivars/${id}`));
}

/**
 * The harvest calendar: recorded pick dates across regions and seasons.
 *
 * The endpoint restricts itself to cultivars published to this site; there is no
 * parameter that widens it, and passing one is a 400. Omitting the season lets
 * the server pick the most recent one with data, because every season drawn on
 * one calendar axis reads as a single impossibly busy year.
 */
export function getMaturityChart(filters: PublicMaturityFilters = {}) {
  return getJson<PublicMaturityChart>(publicPath(`/maturity-chart${maturityChartQuery(filters)}`));
}

export function mediaUrl(mediaId: number | null | undefined): string | null {
  if (!mediaId) return null;
  return `${API_BASE}${publicPath(`/media/${mediaId}/file`, { noOrigin: true })}`;
}
