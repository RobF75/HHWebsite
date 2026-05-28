import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getCatalog, placeOrder } from '../lib/storefront';
import type { CatalogItem } from '../lib/types';
import { useAuth } from '../context/AuthContext';

function money(n: number) {
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
}

function itemLabel(it: CatalogItem) {
  const name = it.cultivar_trade_name || it.cultivar_name;
  const root = it.rootstock_name ? ` on ${it.rootstock_name}` : '';
  return `${name}${root}`;
}

export default function OrderPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cultivarParam = searchParams.get('cultivar');
  const cultivarFilter = cultivarParam ? Number(cultivarParam) : null;

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [qty, setQty] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCatalog(cultivarFilter ?? undefined)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load catalogue');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cultivarFilter]);

  const filterName = cultivarFilter && items.length > 0 ? (items[0].cultivar_trade_name || items[0].cultivar_name) : null;

  function setQuantity(id: number, value: string) {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    setQty((q) => ({ ...q, [id]: n }));
  }

  const lines = useMemo(
    () => items.filter((it) => (qty[it.stock_item_id] ?? 0) > 0),
    [items, qty]
  );

  const total = useMemo(
    () => lines.reduce((sum, it) => sum + Number(it.website_price) * (qty[it.stock_item_id] ?? 0), 0),
    [lines, qty]
  );

  const totalTrees = useMemo(
    () => lines.reduce((sum, it) => sum + (qty[it.stock_item_id] ?? 0), 0),
    [lines, qty]
  );

  async function submit() {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const created = await placeOrder({
        lines: lines.map((it) => ({ stock_item_id: it.stock_item_id, quantity_ordered: qty[it.stock_item_id] })),
        notes: notes.trim() || undefined,
        requested_delivery_date: deliveryDate || undefined,
      });
      navigate('/account/orders', { state: { placed: created.length } });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not place order');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container-prose py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent-700 mb-4">Place an order</p>
          <h1 className="font-serif text-4xl md:text-5xl tracking-tightish leading-[1.05]">Order trees</h1>
          {user?.organisation_name && (
            <p className="mt-3 text-sm text-ink-muted">Ordering as {user.organisation_name}</p>
          )}
        </div>
      </div>

      {!user?.email_verified && (
        <div className="mt-8 rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Please verify your email address — check your inbox for the verification link.
        </div>
      )}

      {cultivarFilter && (
        <div className="mt-8 flex items-center justify-between gap-3 rounded-sm border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm">
          <span className="text-ink-muted">
            Showing {filterName ? <span className="text-ink font-medium">{filterName}</span> : 'one cultivar'} only.
          </span>
          <Link to="/order" className="text-accent-700 underline">Show full catalogue</Link>
        </div>
      )}

      {loading && <p className="mt-12 text-ink-muted">Loading catalogue…</p>}
      {loadError && <p className="mt-12 text-red-700">{loadError}</p>}

      {!loading && !loadError && items.length === 0 && (
        <p className="mt-12 text-ink-muted">No stock is currently available to order online. Please check back soon.</p>
      )}

      {!loading && items.length > 0 && (
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1fr_20rem] gap-10 items-start">
          {/* Catalogue */}
          <div className="divide-y divide-stone-200 border-y border-stone-200">
            {items.map((it) => {
              const price = Number(it.website_price);
              const n = qty[it.stock_item_id] ?? 0;
              return (
                <div key={it.stock_item_id} className="flex items-center gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-serif text-lg leading-snug">{itemLabel(it)}</div>
                    <div className="text-xs text-ink-muted mt-0.5">
                      {it.tree_type_name}
                      {it.species_name ? ` · ${it.species_name}` : ''}
                      {it.sku_code ? ` · ${it.sku_code}` : ''}
                    </div>
                  </div>
                  <div className="w-24 text-right text-sm tabular-nums">{money(price)}</div>
                  <input
                    type="number"
                    min={0}
                    value={n || ''}
                    placeholder="0"
                    onChange={(e) => setQuantity(it.stock_item_id, e.target.value)}
                    className="w-20 rounded-sm border border-stone-300 px-2 py-1.5 text-sm text-right focus:border-accent-700 focus:outline-none"
                  />
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <aside className="lg:sticky lg:top-28 rounded-sm border border-stone-200 bg-white p-5">
            <h2 className="font-serif text-xl mb-4">Your order</h2>
            {lines.length === 0 ? (
              <p className="text-sm text-ink-muted">Enter quantities to build your order.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {lines.map((it) => (
                  <li key={it.stock_item_id} className="flex justify-between gap-3">
                    <span className="text-ink-muted truncate">{qty[it.stock_item_id]} × {itemLabel(it)}</span>
                    <span className="tabular-nums">{money(Number(it.website_price) * qty[it.stock_item_id])}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 border-t border-stone-200 pt-4 flex justify-between text-sm font-medium">
              <span>{totalTrees} tree{totalTrees === 1 ? '' : 's'}</span>
              <span className="tabular-nums">{money(total)}</span>
            </div>

            <label className="mt-5 block">
              <span className="block text-xs text-ink-muted mb-1">Requested delivery date</span>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full rounded-sm border border-stone-300 px-2 py-1.5 text-sm focus:border-accent-700 focus:outline-none"
              />
            </label>
            <label className="mt-3 block">
              <span className="block text-xs text-ink-muted mb-1">Notes</span>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-sm border border-stone-300 px-2 py-1.5 text-sm focus:border-accent-700 focus:outline-none"
              />
            </label>

            {submitError && <p className="mt-3 text-sm text-red-700">{submitError}</p>}

            <button
              type="button"
              disabled={lines.length === 0 || submitting}
              onClick={submit}
              className="mt-4 w-full rounded-sm bg-accent-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-800 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit order request'}
            </button>
            <p className="mt-3 text-xs text-ink-muted leading-relaxed">
              Submitting creates a draft order request. Our team will confirm availability and delivery.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
