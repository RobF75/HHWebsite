import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiError, getSite, setKnownSlug } from '../lib/api';
import { SITE_TARGET, movedUrl } from '../lib/site';
import type { PublicSite } from '../lib/types';

/**
 * The site being shown (lib/site.ts). Ours is fixed here and needs no
 * request; an organisation's is loaded once, before anything renders, so its
 * name, colours and what it offers are known everywhere.
 */

const PLATFORM_SITE: PublicSite = {
  slug: 'factree',
  name: 'Factree',
  kind: 'hosted',
  is_platform_site: true,
  shop: true,
  has_logo: false,
  branding: {
    header_text: null,
    tagline: null,
    about: null,
    primary_color: null,
    contact_email: null,
    contact_phone: null,
  },
};

const SiteContext = createContext<PublicSite>(PLATFORM_SITE);

// eslint-disable-next-line react-refresh/only-export-components
export const useSite = () => useContext(SiteContext);

function SiteMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-4xl tracking-tightish">{title}</h1>
        <p className="mt-4 text-ink-muted">{body}</p>
      </div>
    </div>
  );
}

export function SiteProvider({ children }: { children: ReactNode }) {
  const [site, setSite] = useState<PublicSite | null>(SITE_TARGET.kind === 'platform' ? PLATFORM_SITE : null);
  const [failure, setFailure] = useState<'missing' | 'error' | null>(null);

  useEffect(() => {
    if (SITE_TARGET.kind === 'platform') return;
    let cancelled = false;
    getSite()
      .then((s) => {
        if (cancelled) return;
        setKnownSlug(s.slug);
        setSite(s);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === 'SITE_MOVED' && err.movedTo) {
          window.location.replace(movedUrl(err.movedTo));
          return;
        }
        setFailure(err instanceof ApiError && err.code === 'SITE_NOT_FOUND' ? 'missing' : 'error');
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!site) return;
    if (!site.is_platform_site) document.title = site.branding.header_text || site.name;
    const color = site.branding.primary_color;
    if (color) document.documentElement.style.setProperty('--site-primary', color);
  }, [site]);

  if (failure === 'missing') {
    return <SiteMessage title="No site here" body="There's no website at this address, or it isn't public yet." />;
  }
  if (failure === 'error') {
    return <SiteMessage title="Can't load this site" body="Something went wrong loading this website. Please try again shortly." />;
  }
  if (!site) return null;

  return <SiteContext.Provider value={site}>{children}</SiteContext.Provider>;
}
