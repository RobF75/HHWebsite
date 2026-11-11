import type {
  ApiEnvelope,
  PublicCultivarDetail,
  PublicCultivarSummary,
  PublicMaturityChart,
  PublicMaturityFilters,
  PublicMerchandise,
  PublicProduct,
  PublicProductDetail,
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
 * Umbrella products the site lists publicly. Only an organisation's site has
 * any; ours, and a server older than 2026-11-11, answer with none.
 */
export async function listProducts(speciesSlug?: string): Promise<PublicProduct[]> {
  if (SITE_TARGET.kind === 'platform') return [];
  const qs = speciesSlug ? `?species=${encodeURIComponent(speciesSlug)}` : '';
  try {
    return await getJson<PublicProduct[]>(publicPath(`/products${qs}`));
  } catch (err) {
    // An older server has no such route: no products, the cultivars still show.
    if (err instanceof ApiError && err.status === 404) return [];
    throw err;
  }
}

export function getProduct(id: number) {
  return getJson<PublicProductDetail>(publicPath(`/products/${id}`));
}

/**
 * Merchandise the site shows publicly (fertiliser, pots). Only an
 * organisation's site has any; ours, and a server older than 2026-11-11,
 * answer with none.
 */
export async function listMerchandise(): Promise<PublicMerchandise[]> {
  if (SITE_TARGET.kind === 'platform') return [];
  try {
    return await getJson<PublicMerchandise[]>(publicPath('/merchandise'));
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return [];
    throw err;
  }
}

export function getMerchandise(id: number) {
  return getJson<PublicMerchandise>(publicPath(`/merchandise/${id}`));
}

/**
 * The widths the API serves a photo at (HHNodeServer utils/photoSizes.js).
 * It makes each the first time it is asked for and keeps it; any other width
 * is answered with the next one up, so ask for these only.
 */
export const PHOTO_WIDTHS = [400, 800, 1200, 2000] as const;
export type PhotoWidth = (typeof PHOTO_WIDTHS)[number];

/** `sizes` for a card in a grid of up to four columns. */
export const CARD_SIZES = '(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw';
/** `sizes` for the photo on a cultivar, product or supply page. */
export const PAGE_PHOTO_SIZES = '(min-width: 1024px) 60vw, 100vw';

function withQuery(url: string, key: string, value: string | number): string {
  return `${url}${url.includes('?') ? '&' : '?'}${key}=${value}`;
}

/** "url?w=400 400w, …" for an <img srcSet>. */
function srcSetOf(urlAt: (w: PhotoWidth) => string): string {
  return PHOTO_WIDTHS.map((w) => `${urlAt(w)} ${w}w`).join(', ');
}

function merchandiseBase(item: Pick<PublicMerchandise, 'id' | 'image_version'>): string {
  const base = `${API_BASE}${publicPath(`/merchandise/${item.id}/image`, { noOrigin: true })}`;
  return item.image_version ? withQuery(base, 'v', item.image_version) : base;
}

/** The item's picture at `width`, or null. The version busts an old cached copy. */
export function merchandiseImageUrl(
  item: Pick<PublicMerchandise, 'id' | 'has_image' | 'image_version'>,
  width: PhotoWidth = 1200,
): string | null {
  if (!item.has_image) return null;
  return withQuery(merchandiseBase(item), 'w', width);
}

/** The item's picture at every width, or undefined. */
export function merchandiseSrcSet(item: Pick<PublicMerchandise, 'id' | 'has_image' | 'image_version'>): string | undefined {
  if (!item.has_image) return undefined;
  const base = merchandiseBase(item);
  return srcSetOf((w) => withQuery(base, 'w', w));
}

/** "3 cultivars · 2 products", for a species tile. */
export function speciesCountText(s: PublicSpecies): string {
  const parts: string[] = [];
  if (s.cultivar_count > 0) parts.push(`${s.cultivar_count} cultivar${s.cultivar_count === 1 ? '' : 's'}`);
  const products = s.product_count ?? 0;
  if (products > 0) parts.push(`${products} product${products === 1 ? '' : 's'}`);
  return parts.join(' · ');
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

/**
 * A photo at `width`. The API keeps the full picture for evaluations and only
 * ever sends a site a sized copy, without the camera's location.
 */
export function mediaUrl(mediaId: number | null | undefined, width: PhotoWidth = 1200): string | null {
  if (!mediaId) return null;
  return withQuery(`${API_BASE}${publicPath(`/media/${mediaId}/file`, { noOrigin: true })}`, 'w', width);
}

/** A photo at every width, for <img srcSet>, or undefined. */
export function mediaSrcSet(mediaId: number | null | undefined): string | undefined {
  if (!mediaId) return undefined;
  const base = `${API_BASE}${publicPath(`/media/${mediaId}/file`, { noOrigin: true })}`;
  return srcSetOf((w) => withQuery(base, 'w', w));
}
