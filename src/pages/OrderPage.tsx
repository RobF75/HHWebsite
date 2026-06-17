import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getCatalog, placeOrder, quoteDelivery } from '../lib/storefront';
import type { DeliveryQuote } from '../lib/storefront';
import type { CatalogItem } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import PbrMark from '../components/PbrMark';
import PbrNotice from '../components/PbrNotice';
import { isPbrProtected } from '../lib/pbr';

function money(n: number) {
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
}

function itemLabel(it: CatalogItem) {
  const name = it.cultivar_trade_name || it.cultivar_name;
  const root = it.rootstock_name ? ` on ${it.rootstock_name}` : '';
  return `${name}${root}`;
}

// Effective per-unit price for a given quantity: the highest volume break whose
// threshold the quantity meets, else the base tier price. Mirrors the server's
// resolveUnitPriceForTier so the basket total matches what's charged.
function unitPriceFor(it: CatalogItem, qty: number): number {
  const q = Math.max(qty, 1);
  if (it.price_breaks && it.price_breaks.length > 0) {
    const applicable = it.price_breaks
      .filter((b) => b.min_quantity <= q)
      .sort((a, b) => b.min_quantity - a.min_quantity)[0];
    if (applicable) return applicable.unit_price;
  }
  return it.unit_price;
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

  // Fulfilment
  const [fulfilment, setFulfilment] = useState<'pickup' | 'delivery'>('pickup');
  const [postcode, setPostcode] = useState('');
  const [address, setAddress] = useState('');
  const [quotes, setQuotes] = useState<DeliveryQuote[]>([]);
  const [quoting, setQuoting] = useState(false);

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
    () => lines.reduce((sum, it) => sum + unitPriceFor(it, qty[it.stock_item_id] ?? 0) * (qty[it.stock_item_id] ?? 0), 0),
    [lines, qty]
  );

  // The customer's tier (consistent across a single-nursery catalogue).
  const tierName = items.find((it) => it.tier_name)?.tier_name ?? null;

  // Quote delivery whenever the basket / postcode / method changes (debounced).
  const lineKey = lines.map((it) => `${it.stock_item_id}:${qty[it.stock_item_id]}`).join(',');
  useEffect(() => {
    if (fulfilment !== 'delivery' || lines.length === 0 || postcode.trim().length < 3) {
      setQuotes([]);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    const timer = setTimeout(() => {
      quoteDelivery({
        lines: lines.map((it) => ({ stock_item_id: it.stock_item_id, quantity_ordered: qty[it.stock_item_id] })),
        fulfilment_method: 'delivery',
        delivery_postcode: postcode.trim(),
      })
        .then((q) => { if (!cancelled) setQuotes(q); })
        .catch(() => { if (!cancelled) setQuotes([]); })
        .finally(() => { if (!cancelled) setQuoting(false); });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fulfilment, postcode, lineKey]);

  const deliveryFee = useMemo(
    () => (fulfilment === 'delivery' ? quotes.reduce((sum, q) => sum + (q.available ? q.fee : 0), 0) : 0),
    [fulfilment, quotes]
  );
  const deliveryUnavailable = fulfilment === 'delivery' && quotes.length > 0 && quotes.some((q) => !q.available);
  const grandTotal = total + deliveryFee;

  const totalTrees = useMemo(
    () => lines.reduce((sum, it) => sum + (qty[it.stock_item_id] ?? 0), 0),
    [lines, qty]
  );

  async function submit() {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const result = await placeOrder({
        lines: lines.map((it) => ({ stock_item_id: it.stock_item_id, quantity_ordered: qty[it.stock_item_id] })),
        notes: notes.trim() || undefined,
        requested_delivery_date: deliveryDate || undefined,
        fulfilment_method: fulfilment,
        delivery_postcode: fulfilment === 'delivery' ? postcode.trim() : undefined,
        delivery_address: fulfilment === 'delivery' ? address.trim() || undefined : undefined,
      });
      // Retail: redirect to Stripe Checkout. Wholesale: straight to the orders page.
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
        return;
      }
      navigate('/account/orders', { state: { placed: result.orders.length, paymentPending: result.payment_pending } });
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
            <p className="mt-3 text-sm text-ink-muted">
              Ordering as {user.organisation_name}
              {tierName && <span className="ml-2 inline-flex items-center rounded-sm border border-accent-200 bg-accent-50 px-2 py-0.5 text-xs text-accent-800">{tierName} pricing</span>}
            </p>
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
        <>
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1fr_20rem] gap-10 items-start">
          {/* Catalogue */}
          <div className="divide-y divide-stone-200 border-y border-stone-200">
            {items.map((it) => {
              const n = qty[it.stock_item_id] ?? 0;
              const price = unitPriceFor(it, n);
              const hasBreaks = it.price_breaks && it.price_breaks.length > 1;
              const discounted = price < it.list_price;
              return (
                <div key={it.stock_item_id} className="flex items-center gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-serif text-lg leading-snug">
                      {itemLabel(it)}
                      <PbrMark status={it.cultivar_protection_status} />
                    </div>
                    <div className="text-xs text-ink-muted mt-0.5">
                      {it.tree_type_name}
                      {it.species_name ? ` · ${it.species_name}` : ''}
                      {it.sku_code ? ` · ${it.sku_code}` : ''}
                      {hasBreaks ? ' · volume pricing' : ''}
                    </div>
                  </div>
                  <div className="w-24 text-right text-sm tabular-nums">
                    {money(price)}
                    {discounted && (
                      <span className="block text-[11px] text-ink-muted line-through">{money(it.list_price)}</span>
                    )}
                  </div>
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
                    <span className="tabular-nums">{money(unitPriceFor(it, qty[it.stock_item_id]) * qty[it.stock_item_id])}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 border-t border-stone-200 pt-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-ink-muted">
                <span>{totalTrees} tree{totalTrees === 1 ? '' : 's'}</span>
                <span className="tabular-nums">{money(total)}</span>
              </div>
              {fulfilment === 'delivery' && (
                <div className="flex justify-between text-ink-muted">
                  <span>Delivery{quoting ? '…' : ''}</span>
                  <span className="tabular-nums">{deliveryUnavailable ? '—' : money(deliveryFee)}</span>
                </div>
              )}
              <div className="flex justify-between font-medium border-t border-stone-100 pt-1.5">
                <span>Total</span>
                <span className="tabular-nums">{money(grandTotal)}</span>
              </div>
            </div>

            {/* Fulfilment */}
            <div className="mt-5">
              <span className="block text-xs text-ink-muted mb-1.5">Fulfilment</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFulfilment('pickup')}
                  className={`flex-1 rounded-sm border px-3 py-2 text-sm transition-colors ${fulfilment === 'pickup' ? 'border-accent-700 bg-accent-50 text-accent-800' : 'border-stone-300 text-ink-muted hover:border-stone-400'}`}
                >
                  Pickup (free)
                </button>
                <button
                  type="button"
                  onClick={() => setFulfilment('delivery')}
                  className={`flex-1 rounded-sm border px-3 py-2 text-sm transition-colors ${fulfilment === 'delivery' ? 'border-accent-700 bg-accent-50 text-accent-800' : 'border-stone-300 text-ink-muted hover:border-stone-400'}`}
                >
                  Delivery
                </button>
              </div>
              {fulfilment === 'delivery' && (
                <div className="mt-3 space-y-2">
                  <input
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                    placeholder="Delivery postcode"
                    className="w-full rounded-sm border border-stone-300 px-2 py-1.5 text-sm focus:border-accent-700 focus:outline-none"
                  />
                  <textarea
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Delivery address"
                    className="w-full rounded-sm border border-stone-300 px-2 py-1.5 text-sm focus:border-accent-700 focus:outline-none"
                  />
                  {deliveryUnavailable && (
                    <p className="text-xs text-red-700">Delivery isn't available to that postcode — please choose pickup or contact us.</p>
                  )}
                </div>
              )}
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
              disabled={
                lines.length === 0 ||
                submitting ||
                (fulfilment === 'delivery' && (postcode.trim().length < 3 || deliveryUnavailable || quoting))
              }
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
        <PbrNotice
          show={items.some((it) => isPbrProtected(it.cultivar_protection_status))}
          className="mt-8"
        />
        </>
      )}
    </div>
  );
}
