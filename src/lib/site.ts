/**
 * Which site this page is: ours, or another organisation's
 * (HHjsFrontEnd docs/tenant-websites-plan.md).
 *
 * One build serves every site. Ours answers at website.factree.com.au (and,
 * later, factree.com.au); an organisation's at {slug}.factree.com.au and
 * nowhere else (Rob, 2026-11-09: a domain the organisation controls could
 * carry a copy of the sign-in page, so no site lives on one). Ours reads the
 * v1 public API exactly as before; an organisation's reads /api/public/v2,
 * where the server works out the site from the browser's Origin header.
 * Any other domain pointed at us shows no site and asks the API nothing.
 *
 * Local development: http://localhost:5174/?site=smiths previews a site and
 * remembers it for the tab; ?site= with no value goes back to ours.
 */

export type SiteTarget =
  | { kind: 'platform' }
  | { kind: 'tenant'; slug: string }
  // A domain that is not ours: no site lives there.
  | { kind: 'none' };

export const BASE_DOMAINS = ['factree.com.au', 'factree.au'];

// Our own hosts under the base domains. Every other label is an
// organisation's (HHNodeServer services/orgSiteService.js reserves these).
const PLATFORM_LABELS = new Set(['website', 'www']);

const PREVIEW_KEY = 'ff_site_preview';

function isLocal(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function localPreview(search: string): string | null {
  const param = new URLSearchParams(search).get('site');
  try {
    if (param !== null) {
      if (param) sessionStorage.setItem(PREVIEW_KEY, param.toLowerCase());
      else sessionStorage.removeItem(PREVIEW_KEY);
      return param ? param.toLowerCase() : null;
    }
    return sessionStorage.getItem(PREVIEW_KEY);
  } catch {
    return param ? param.toLowerCase() : null;
  }
}

export function siteFromLocation(hostname: string, search: string): SiteTarget {
  const host = hostname.toLowerCase();
  if (isLocal(host)) {
    const slug = localPreview(search);
    return slug ? { kind: 'tenant', slug } : { kind: 'platform' };
  }
  for (const base of BASE_DOMAINS) {
    if (host === base) return { kind: 'platform' };
    if (host.endsWith(`.${base}`)) {
      const label = host.slice(0, -(base.length + 1));
      if (PLATFORM_LABELS.has(label) || label.includes('.')) return { kind: 'platform' };
      return { kind: 'tenant', slug: label };
    }
  }
  // A machine name or an address (the dev box reached directly) is ours; any
  // other domain is somebody pointing their own domain at us, and has no site.
  if (!host.includes('.') || /^[\d.]+$/.test(host)) return { kind: 'platform' };
  return { kind: 'none' };
}

export const SITE_TARGET: SiteTarget = siteFromLocation(window.location.hostname, window.location.search);

export const isLocalPreview = () => isLocal(window.location.hostname.toLowerCase());

/** Where an organisation's site now lives, after it changed its address. */
export function movedUrl(slug: string): string {
  const { protocol, host, pathname, search, hash } = window.location;
  if (isLocalPreview()) return `${protocol}//${host}${pathname}?site=${slug}${hash}`;
  const base = BASE_DOMAINS.find((b) => window.location.hostname.endsWith(`.${b}`)) || BASE_DOMAINS[0];
  return `https://${slug}.${base}${pathname}${search}${hash}`;
}
