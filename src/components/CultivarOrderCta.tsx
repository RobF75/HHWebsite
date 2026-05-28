import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCatalog } from '../lib/storefront';
import type { CatalogItem } from '../lib/types';

function money(v: string) {
  const n = Number(v);
  return Number.isNaN(n) ? '' : n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
}

/**
 * Ordering CTA shown on a cultivar page. For signed-in customers it loads the
 * orderable stock items (those with a website price) for this cultivar and links
 * straight to the order page pre-filtered to it. Signed-out visitors are invited
 * to sign in or enquire.
 */
export default function CultivarOrderCta({ cultivarId }: { cultivarId: number }) {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setItems(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getCatalog(cultivarId)
      .then((data) => { if (!cancelled) setItems(data); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, cultivarId]);

  // Signed out — invite to sign in / enquire.
  if (!user) {
    return (
      <div className="rounded bg-accent-50 border border-accent-200 p-6">
        <h3 className="font-serif text-lg mb-2">Order this cultivar</h3>
        <p className="text-sm text-ink-muted mb-4">
          Trade customers can order online. Sign in to see availability and pricing.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/login"
            state={{ from: `/order?cultivar=${cultivarId}` }}
            className="inline-flex items-center gap-2 bg-ink text-stone-50 px-5 py-2.5 rounded-sm text-sm hover:bg-accent-700 transition-colors"
          >
            Sign in to order
          </Link>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 border border-stone-300 px-5 py-2.5 rounded-sm text-sm text-ink hover:border-accent-700 hover:text-accent-700 transition-colors"
          >
            Enquire
          </Link>
        </div>
        {!authLoading && (
          <p className="mt-3 text-xs text-ink-muted">
            New customer? <Link to="/register" className="underline">Create an account</Link>
          </p>
        )}
      </div>
    );
  }

  // Signed in but this cultivar isn't sold online.
  if (items !== null && !loading && items.length === 0) {
    return (
      <div className="rounded bg-accent-50 border border-accent-200 p-6">
        <h3 className="font-serif text-lg mb-2">Order this cultivar</h3>
        <p className="text-sm text-ink-muted mb-4">
          This cultivar isn't available to order online right now. Get in touch and we'll help with availability.
        </p>
        <Link
          to="/contact"
          className="inline-flex items-center gap-2 bg-ink text-stone-50 px-5 py-2.5 rounded-sm text-sm hover:bg-accent-700 transition-colors"
        >
          Enquire
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded bg-accent-50 border border-accent-200 p-6">
      <h3 className="font-serif text-lg mb-2">Order this cultivar</h3>
      {loading || items === null ? (
        <p className="text-sm text-ink-muted">Checking availability…</p>
      ) : (
        <>
          <ul className="mb-4 divide-y divide-accent-200/60 border-y border-accent-200/60">
            {items.map((it) => (
              <li key={it.stock_item_id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <span className="text-ink">
                  {it.tree_type_name}
                  {it.rootstock_name ? ` · on ${it.rootstock_name}` : ''}
                </span>
                <span className="tabular-nums text-ink-muted">{money(it.website_price)}</span>
              </li>
            ))}
          </ul>
          <Link
            to={`/order?cultivar=${cultivarId}`}
            className="inline-flex items-center gap-2 bg-ink text-stone-50 px-5 py-2.5 rounded-sm text-sm hover:bg-accent-700 transition-colors"
          >
            Order now
          </Link>
        </>
      )}
    </div>
  );
}
